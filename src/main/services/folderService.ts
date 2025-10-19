import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { logInfo, logError } from './logService';

/**
 * Initialize work directory structure
 */
export async function initWorkDir(workDir: string): Promise<void> {
  try {
    // Create main work directory
    await ensureDir(workDir);

    // Create subdirectories
    await ensureDir(path.join(workDir, '_input'));
    await ensureDir(path.join(workDir, '_out'));
    await ensureDir(path.join(workDir, '_logs'));

    logInfo('Work directory initialized', { workDir });
  } catch (error) {
    logError('Failed to initialize work directory', error);
    throw error;
  }
}

/**
 * Ensure directory exists, create if not
 */
async function ensureDir(dirPath: string): Promise<void> {
  if (!fsSync.existsSync(dirPath)) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Copy input file to _input directory with timestamp
 */
export async function copyInputFile(
  sourceFilePath: string,
  workDir: string
): Promise<string> {
  try {
    const inputDir = path.join(workDir, '_input');
    await ensureDir(inputDir);

    // Generate timestamped filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '')
      .split('T')
      .join('_')
      .substring(0, 15);
    const ext = path.extname(sourceFilePath);
    const baseName = path.basename(sourceFilePath, ext);
    const newFileName = `${baseName}_${timestamp}${ext}`;
    const destPath = path.join(inputDir, newFileName);

    // Copy file
    await fs.copyFile(sourceFilePath, destPath);

    logInfo('Input file copied', { source: sourceFilePath, destination: destPath });

    return destPath;
  } catch (error) {
    logError('Failed to copy input file', error);
    throw error;
  }
}

/**
 * Get output file path for card file
 */
export function getOutputFilePath(
  workDir: string,
  inputFileName: string,
  label: string
): string {
  const outDir = path.join(workDir, '_out');
  const baseName = path.basename(inputFileName, path.extname(inputFileName));
  return path.join(outDir, `${baseName}_${label}.json`);
}

/**
 * Get logs directory path
 */
export function getLogsDir(workDir: string): string {
  return path.join(workDir, '_logs');
}

/**
 * List files in directory
 */
export async function listFiles(dirPath: string, extension?: string): Promise<string[]> {
  try {
    if (!fsSync.existsSync(dirPath)) {
      return [];
    }

    const files = await fs.readdir(dirPath);

    if (extension) {
      return files.filter((file) => file.endsWith(extension));
    }

    return files;
  } catch (error) {
    logError('Failed to list files', error);
    return [];
  }
}

/**
 * Get directory size
 */
export async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    if (!fsSync.existsSync(dirPath)) {
      return 0;
    }

    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      if (item.isDirectory()) {
        totalSize += await getDirectorySize(itemPath);
      } else {
        const stat = await fs.stat(itemPath);
        totalSize += stat.size;
      }
    }
  } catch (error) {
    logError('Failed to get directory size', error);
  }

  return totalSize;
}

/**
 * Clean directory (delete all files, keep directory)
 */
export async function cleanDirectory(dirPath: string): Promise<void> {
  try {
    if (!fsSync.existsSync(dirPath)) {
      return;
    }

    const items = await fs.readdir(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = await fs.stat(itemPath);

      if (stat.isDirectory()) {
        await fs.rm(itemPath, { recursive: true });
      } else {
        await fs.unlink(itemPath);
      }
    }

    logInfo('Directory cleaned', { path: dirPath });
  } catch (error) {
    logError('Failed to clean directory', error);
    throw error;
  }
}

/**
 * Validate work directory structure
 */
export async function validateWorkDir(workDir: string): Promise<boolean> {
  try {
    const requiredDirs = ['_input', '_out', '_logs'];

    for (const dir of requiredDirs) {
      const dirPath = path.join(workDir, dir);
      if (!fsSync.existsSync(dirPath)) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}
