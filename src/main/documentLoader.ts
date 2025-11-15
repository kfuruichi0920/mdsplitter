/**
 * @file documentLoader.ts
 * @brief 入力ドキュメントのエンコーディング判定および読込ユーティリティ。
 * @details
 * ファイルサイズしきい値判定、文字コード検出、BOM除去、改行正規化を担い、
 * Electron メインプロセスから Markdown/テキストを安全に読み込む。
 * 例:
 * @code
 * const doc = await loadDocumentFromPath('/tmp/spec.md', settings);
 * console.log(doc.encoding, doc.sizeStatus);
 * @endcode
 * ファイル拡張子と BOM から Markdown 判定とエンコーディング決定を行う。
 * @author K.Furuichi
 * @date 2025-11-15
 * @version 0.1
 * @copyright MIT
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { AppSettings, EncodingFallback } from '@/shared/settings';

/** @brief 1MB あたりのバイト数。 */
export const BYTES_PER_MB = 1024 * 1024;

/**
 * @brief サポートするテキストエンコーディング種別。
 */
export type DocumentEncoding = 'utf8' | 'utf8-bom' | 'utf16le' | 'utf16be' | 'shift_jis';

/**
 * @brief ファイルサイズの判定結果。
 */
export type FileSizeStatus = 'ok' | 'warn' | 'abort';

/**
 * @brief 検出されたエンコーディング情報。
 */
export interface DetectedEncoding {
  encoding: DocumentEncoding;
  bomBytes: number;
}

/**
 * @brief 読み込まれたドキュメント情報。
 */
export interface LoadedDocument {
  fileName: string;
  baseName: string;
  extension: string;
  originalPath: string;
  sizeBytes: number;
  encoding: DocumentEncoding;
  content: string;
  isMarkdown: boolean;
  sizeStatus: FileSizeStatus;
}

export type DocumentLoadErrorCode = 'FILE_TOO_LARGE' | 'UNSUPPORTED_ENCODING' | 'READ_FAILED';

/**
 * @brief ドキュメント読込時のエラー。
 * @details
 * ファイルサイズ超過・文字コード未対応・読み込み失敗などを区別。
 */
export class DocumentLoadError extends Error {
  public readonly code: DocumentLoadErrorCode;

  constructor(message: string, code: DocumentLoadErrorCode) {
    super(message);
    this.name = 'DocumentLoadError';
    this.code = code;
  }
}

/**
 * @brief ファイルサイズを警告/中断閾値に照らして評価する。
 * @param sizeBytes ファイルサイズ (byte)。
 * @param warnSizeMB 警告閾値 (MB)。
 * @param abortSizeMB 中断閾値 (MB)。
 * @return 判定結果。
 */
export const evaluateFileSizeStatus = (
  sizeBytes: number,
  warnSizeMB: number,
  abortSizeMB: number,
): FileSizeStatus => {
  const warnBytes = warnSizeMB * BYTES_PER_MB;
  const abortBytes = abortSizeMB * BYTES_PER_MB;
  if (sizeBytes > abortBytes) {
    return 'abort';
  }
  if (sizeBytes > warnBytes) {
    return 'warn';
  }
  return 'ok';
};

/**
 * @brief BOM バイトを除去した Buffer を取得。
 * @param buffer 元のバッファ。
 * @param bomBytes 先頭の BOM バイト数。
 * @return BOM 除去後のバッファ。
 */
const sliceBom = (buffer: Buffer, bomBytes: number): Buffer => {
  if (bomBytes <= 0) {
    return buffer;
  }
  return buffer.subarray(bomBytes);
};

/**
 * @brief 指定ラベルの TextDecoder でデコード。
 * @param label WHATWG ラベル。
 * @param buffer 対象バッファ。
 * @param fatal 不正シーケンス時に例外を投げるか。
 * @return デコード文字列。
 * @throws TypeError 未対応エンコーディングの場合。
 */
const decodeWith = (label: string, buffer: Buffer, fatal = true): string => {
  const decoder = new TextDecoder(label, { fatal });
  return decoder.decode(buffer);
};

/**
 * @brief 指定エンコーディングでデコードを試行。
 * @param label WHATWG ラベル。
 * @param buffer 対象バッファ。
 * @return 成功時は文字列、失敗時は null。
 */
const tryDecode = (label: string, buffer: Buffer): string | null => {
  try {
    return decodeWith(label, buffer, true);
  } catch (error) {
    return null;
  }
};

/**
 * @brief 先頭の BOM パターンを検出。
 * @param buffer 調査対象バッファ。
 * @return 検出結果。BOM が無い場合は null。
 */
const stripLeadingBom = (buffer: Buffer): { encoding: DocumentEncoding; bomBytes: number } | null => {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { encoding: 'utf8-bom', bomBytes: 3 };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { encoding: 'utf16le', bomBytes: 2 };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { encoding: 'utf16be', bomBytes: 2 };
  }
  return null;
};

/**
 * @brief バイト列の 0 パターンから UTF-16 らしさを推定。
 * @param buffer 対象バッファ。
 * @param endian リトル/ビッグの仮定。
 * @return UTF-16 らしい場合は true。
 */
const looksLikeUtf16 = (buffer: Buffer, endian: 'le' | 'be'): boolean => {
  if (buffer.length < 4) {
    return false;
  }
  let zeroEven = 0;
  let zeroOdd = 0;
  const sample = buffer.subarray(0, Math.min(buffer.length, 64));
  for (let i = 0; i < sample.length; i += 1) {
    if (sample[i] === 0) {
      if (i % 2 === 0) {
        zeroEven += 1;
      } else {
        zeroOdd += 1;
      }
    }
  }
  if (endian === 'le') {
    return zeroOdd > zeroEven * 4;
  }
  return zeroEven > zeroOdd * 4;
};

/**
 * @brief バッファから文字コードを判定する。
 * @param buffer 調査対象。
 * @param fallback 判定不能時のフォールバック戦略。
 * @return 検出結果。
 * @throws DocumentLoadError 文字コードが推定不能かつフォールバック未定義。
 */
export const detectEncoding = (buffer: Buffer, fallback: EncodingFallback = 'reject'): DetectedEncoding => {
  const bom = stripLeadingBom(buffer);
  if (bom) {
    return bom;
  }

  const utf8 = tryDecode('utf-8', buffer);
  if (utf8 !== null) {
    return { encoding: 'utf8', bomBytes: 0 };
  }

  if (looksLikeUtf16(buffer, 'le')) {
    const decoded = tryDecode('utf-16le', buffer);
    if (decoded !== null) {
      return { encoding: 'utf16le', bomBytes: 0 };
    }
  }

  if (looksLikeUtf16(buffer, 'be')) {
    const decoded = tryDecode('utf-16be', buffer);
    if (decoded !== null) {
      return { encoding: 'utf16be', bomBytes: 0 };
    }
  }

  const sjis = tryDecode('shift_jis', buffer);
  if (sjis !== null) {
    return { encoding: 'shift_jis', bomBytes: 0 };
  }

  if (fallback === 'assume-utf8') {
    return { encoding: 'utf8', bomBytes: 0 };
  }
  if (fallback === 'assume-sjis') {
    return { encoding: 'shift_jis', bomBytes: 0 };
  }

  throw new DocumentLoadError('文字コードを判定できませんでした。', 'UNSUPPORTED_ENCODING');
};

/**
 * @brief バッファを指定エンコーディングで文字列化。
 * @param buffer 入力バッファ。
 * @param detection 検出済みエンコーディング情報。
 * @return デコード済み文字列。
 */
export const decodeBuffer = (buffer: Buffer, detection: DetectedEncoding): string => {
  const payload = sliceBom(buffer, detection.bomBytes);
  switch (detection.encoding) {
    case 'utf8-bom':
    case 'utf8':
      return decodeWith('utf-8', payload, false);
    case 'utf16le':
      return decodeWith('utf-16le', payload, false);
    case 'utf16be':
      return decodeWith('utf-16be', payload, false);
    case 'shift_jis':
    default:
      return decodeWith('shift_jis', payload, false);
  }
};

/**
 * @brief 改行コードを LF へ統一。
 * @param text 変換対象文字列。
 * @return LF 正規化済み文字列。
 */
export const normalizeNewlines = (text: string): string => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

/**
 * @brief 拡張子から Markdown かどうか判定。
 * @param ext 拡張子 (lowercase)。
 * @return Markdown 拡張子なら true。
 */
const isMarkdownExtension = (ext: string): boolean => ['.md', '.markdown'].includes(ext);

/**
 * @brief ファイルパスからドキュメントを読み込みメタ情報を返す。
 * @details
 * ファイルサイズ閾値検査後、バイナリ読み込み→文字コード判定→改行正規化を行う。
 * @param filePath 入力ファイルパス。
 * @param settings アプリ設定（サイズ閾値・フォールバック等）。
 * @return 読み込み結果。
 * @throws DocumentLoadError サイズ超過・文字コード未対応・読み込み失敗時。
 */
export const loadDocumentFromPath = async (filePath: string, settings: AppSettings): Promise<LoadedDocument> => {
  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch (error) {
    throw new DocumentLoadError('指定したファイルを読み込めませんでした。', 'READ_FAILED');
  }

  const sizeStatus = evaluateFileSizeStatus(stats.size, settings.input.maxWarnSizeMB, settings.input.maxAbortSizeMB);
  if (sizeStatus === 'abort') {
    throw new DocumentLoadError('ファイルサイズが上限を超えたため読み込みを中断しました。', 'FILE_TOO_LARGE');
  }

  let buffer: Buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch (error) {
    throw new DocumentLoadError('ファイル内容の読み込みに失敗しました。', 'READ_FAILED');
  }

  const detection = detectEncoding(buffer, settings.input.encodingFallback);
  try {
    const decoded = decodeBuffer(buffer, detection);
    const normalized = settings.input.normalizeNewline ? normalizeNewlines(decoded) : decoded;
    const fileName = path.basename(filePath);
    const extension = path.extname(filePath).toLowerCase();
    return {
      fileName,
      baseName: extension ? fileName.slice(0, -extension.length) : fileName,
      extension,
      originalPath: filePath,
      sizeBytes: stats.size,
      encoding: detection.encoding,
      content: normalized,
      isMarkdown: isMarkdownExtension(extension),
      sizeStatus,
    } satisfies LoadedDocument;
  } catch (error) {
    throw new DocumentLoadError('サポートされていない文字コードです。', 'UNSUPPORTED_ENCODING');
  }
};
