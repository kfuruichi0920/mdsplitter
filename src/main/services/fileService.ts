import { dialog, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as Encoding from 'encoding-japanese';
import { FileOpenResult, FileSaveResult, FileDialogOptions, CardFile } from '../../shared/types';
import { getSettings } from './settingsService';
import { logInfo, logError } from './logService';

// File size limits
const FILE_SIZE_WARNING_LIMIT = 10 * 1024 * 1024; // 10MB
const FILE_SIZE_MAX_LIMIT = 200 * 1024 * 1024; // 200MB

/**
 * Detect encoding of file content
 */
function detectEncoding(buffer: Buffer): string {
  const detected = Encoding.detect(buffer);
  if (detected === 'UTF8' || detected === 'UNICODE') {
    return 'UTF-8';
  } else if (detected === 'SJIS') {
    return 'Shift_JIS';
  }
  // Default to UTF-8 if detection fails
  return 'UTF-8';
}

/**
 * Convert buffer to string with proper encoding
 */
function decodeBuffer(buffer: Buffer, encoding: string): string {
  if (encoding === 'UTF-8') {
    return buffer.toString('utf-8');
  } else if (encoding === 'Shift_JIS') {
    const codes = new Uint8Array(buffer);
    const unicodeArray = Encoding.convert(codes, {
      to: 'UNICODE',
      from: 'SJIS',
    });
    return Encoding.codeToString(unicodeArray);
  }
  return buffer.toString('utf-8');
}

/**
 * Normalize line endings to LF
 */
function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Open file dialog and read file content
 */
export async function openFile(
  mainWindow: BrowserWindow | null,
  options?: FileDialogOptions
): Promise<FileOpenResult> {
  try {
    if (!mainWindow) {
      return { success: false, error: 'No window available' };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: options?.title || 'Open File',
      defaultPath: options?.defaultPath,
      filters: options?.filters || [
        { name: 'Text Files', extensions: ['txt', 'md'] },
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: options?.properties || ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'User cancelled' };
    }

    const filePath = result.filePaths[0];
    const stat = await fs.stat(filePath);

    // Check file size
    if (stat.size > FILE_SIZE_MAX_LIMIT) {
      return {
        success: false,
        error: `File size exceeds maximum limit (${FILE_SIZE_MAX_LIMIT / 1024 / 1024}MB)`,
      };
    }

    // Warn if file is large (this warning should be shown in UI)
    if (stat.size > FILE_SIZE_WARNING_LIMIT) {
      console.warn(`Large file detected: ${stat.size / 1024 / 1024}MB`);
    }

    // Read file
    const buffer = await fs.readFile(filePath);

    // Detect encoding
    const encoding = detectEncoding(buffer);

    // Decode and normalize
    let content = decodeBuffer(buffer, encoding);
    content = normalizeLineEndings(content);

    return {
      success: true,
      filePath,
      content,
      encoding,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save file with content
 */
export async function saveFile(filePath: string, content: string): Promise<FileSaveResult> {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Write file (always in UTF-8)
    await fs.writeFile(filePath, content, { encoding: 'utf-8' });

    return {
      success: true,
      filePath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save file with dialog
 */
export async function saveFileAs(
  mainWindow: BrowserWindow | null,
  content: string,
  options?: FileDialogOptions
): Promise<FileSaveResult> {
  try {
    if (!mainWindow) {
      return { success: false, error: 'No window available' };
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      title: options?.title || 'Save File As',
      defaultPath: options?.defaultPath,
      filters: options?.filters || [
        { name: 'JSON Files', extensions: ['json'] },
        { name: 'Text Files', extensions: ['txt', 'md'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'User cancelled' };
    }

    return await saveFile(result.filePath, content);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fsSync.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read file content (without dialog)
 */
export async function readFile(filePath: string): Promise<FileOpenResult> {
  try {
    const stat = await fs.stat(filePath);

    if (stat.size > FILE_SIZE_MAX_LIMIT) {
      return {
        success: false,
        error: `File size exceeds maximum limit (${FILE_SIZE_MAX_LIMIT / 1024 / 1024}MB)`,
      };
    }

    const buffer = await fs.readFile(filePath);
    const encoding = detectEncoding(buffer);
    let content = decodeBuffer(buffer, encoding);
    content = normalizeLineEndings(content);

    return {
      success: true,
      filePath,
      content,
      encoding,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Handle drag and drop file
 */
export async function handleDroppedFile(filePath: string): Promise<FileOpenResult> {
  return readFile(filePath);
}

/**
 * 入力ファイルをコピーして保存
 */
export async function copyInputFile(
  originalPath: string,
  content: string
): Promise<{ success: boolean; copiedPath?: string; error?: string }> {
  try {
    const settings = getSettings();
    const workDir = settings.workDir;

    if (!workDir) {
      return { success: false, error: 'Work directory not configured' };
    }

    // _input フォルダを作成
    const inputDir = path.join(workDir, '_input');
    await fs.mkdir(inputDir, { recursive: true });

    // ファイル名に日時を付与
    const now = new Date();
    const timestamp = now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .replace('T', '_');

    const baseName = path.basename(originalPath, path.extname(originalPath));
    const ext = path.extname(originalPath);
    const copiedFileName = `${baseName}_${timestamp}${ext}`;
    const copiedPath = path.join(inputDir, copiedFileName);

    // ファイルをコピー
    await fs.writeFile(copiedPath, content, { encoding: 'utf-8' });

    logInfo('Input file copied', { originalPath, copiedPath });

    return { success: true, copiedPath };
  } catch (error) {
    logError('Failed to copy input file', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * カードファイルを保存
 */
export async function saveCardFile(
  cardFile: CardFile,
  label?: string
): Promise<{ success: boolean; savedPath?: string; error?: string }> {
  try {
    const settings = getSettings();
    const workDir = settings.workDir;

    if (!workDir) {
      return { success: false, error: 'Work directory not configured' };
    }

    // _out フォルダを作成
    const outDir = path.join(workDir, '_out');
    await fs.mkdir(outDir, { recursive: true });

    // ファイル名を生成
    const inputBaseName = path.basename(
      cardFile.header.orgInputFilePath,
      path.extname(cardFile.header.orgInputFilePath)
    );

    let fileName: string;
    if (label && label.trim() !== '') {
      fileName = `${inputBaseName}_${label}.json`;
    } else {
      fileName = `${inputBaseName}.json`;
    }

    const savedPath = path.join(outDir, fileName);

    // カードファイルをJSON形式で保存
    const jsonContent = JSON.stringify(cardFile, null, 2);
    await fs.writeFile(savedPath, jsonContent, { encoding: 'utf-8' });

    logInfo('Card file saved', {
      savedPath,
      totalCards: cardFile.body.length,
    });

    return { success: true, savedPath };
  } catch (error) {
    logError('Failed to save card file', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * カードファイルを読み込み
 */
export async function loadCardFile(
  filePath: string
): Promise<{ success: boolean; cardFile?: CardFile; error?: string }> {
  try {
    const content = await fs.readFile(filePath, { encoding: 'utf-8' });
    const cardFile: CardFile = JSON.parse(content);

    // 基本的なバリデーション
    if (!cardFile.schemaVersion || !cardFile.header || !cardFile.body) {
      return { success: false, error: 'Invalid card file format' };
    }

    logInfo('Card file loaded', {
      filePath,
      totalCards: cardFile.body.length,
    });

    return { success: true, cardFile };
  } catch (error) {
    logError('Failed to load card file', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
