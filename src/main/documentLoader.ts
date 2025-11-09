import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { AppSettings, EncodingFallback } from '@/shared/settings';

export const BYTES_PER_MB = 1024 * 1024;

export type DocumentEncoding = 'utf8' | 'utf8-bom' | 'utf16le' | 'utf16be' | 'shift_jis';

export type FileSizeStatus = 'ok' | 'warn' | 'abort';

export interface DetectedEncoding {
  encoding: DocumentEncoding;
  bomBytes: number;
}

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

export class DocumentLoadError extends Error {
  public readonly code: DocumentLoadErrorCode;

  constructor(message: string, code: DocumentLoadErrorCode) {
    super(message);
    this.name = 'DocumentLoadError';
    this.code = code;
  }
}

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

const sliceBom = (buffer: Buffer, bomBytes: number): Buffer => {
  if (bomBytes <= 0) {
    return buffer;
  }
  return buffer.subarray(bomBytes);
};

const decodeWith = (label: string, buffer: Buffer, fatal = true): string => {
  const decoder = new TextDecoder(label, { fatal });
  return decoder.decode(buffer);
};

const tryDecode = (label: string, buffer: Buffer): string | null => {
  try {
    return decodeWith(label, buffer, true);
  } catch (error) {
    return null;
  }
};

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

export const normalizeNewlines = (text: string): string => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const isMarkdownExtension = (ext: string): boolean => ['.md', '.markdown'].includes(ext);

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
