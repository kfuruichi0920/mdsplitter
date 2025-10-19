import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { AppSettings } from '../../shared/types';
import { logInfo, logWarn, logError } from './logService';

let settings: AppSettings | null = null;
let settingsFilePath: string = '';

/**
 * Default settings
 */
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  workDir: '',
  fontSize: 14,
  autoSave: true,
  autoSaveInterval: 60, // 60 seconds
  maxUndoSteps: 1000,
  logLevel: 'info',
  llmProvider: undefined,
  llmApiKey: undefined,
  llmModel: undefined,
};

/**
 * Validate settings object
 */
function validateSettings(data: unknown): AppSettings {
  const s = data as Partial<AppSettings>;

  return {
    theme: ['light', 'dark', 'system'].includes(s.theme || '')
      ? (s.theme as AppSettings['theme'])
      : DEFAULT_SETTINGS.theme,
    workDir: typeof s.workDir === 'string' ? s.workDir : DEFAULT_SETTINGS.workDir,
    fontSize:
      typeof s.fontSize === 'number' && s.fontSize >= 10 && s.fontSize <= 32
        ? s.fontSize
        : DEFAULT_SETTINGS.fontSize,
    autoSave: typeof s.autoSave === 'boolean' ? s.autoSave : DEFAULT_SETTINGS.autoSave,
    autoSaveInterval:
      typeof s.autoSaveInterval === 'number' && s.autoSaveInterval >= 10
        ? s.autoSaveInterval
        : DEFAULT_SETTINGS.autoSaveInterval,
    maxUndoSteps:
      typeof s.maxUndoSteps === 'number' && s.maxUndoSteps >= 0
        ? s.maxUndoSteps
        : DEFAULT_SETTINGS.maxUndoSteps,
    logLevel: ['debug', 'info', 'warn', 'error'].includes(s.logLevel || '')
      ? (s.logLevel as AppSettings['logLevel'])
      : DEFAULT_SETTINGS.logLevel,
    llmProvider: ['openai', 'gemini', 'ollama'].includes(s.llmProvider || '')
      ? (s.llmProvider as AppSettings['llmProvider'])
      : undefined,
    llmApiKey: typeof s.llmApiKey === 'string' ? s.llmApiKey : undefined,
    llmModel: typeof s.llmModel === 'string' ? s.llmModel : undefined,
  };
}

/**
 * Initialize settings
 */
export async function initSettings(customPath?: string): Promise<AppSettings> {
  // Determine settings file path
  settingsFilePath =
    customPath || path.join(app.getPath('userData'), 'settings.json');

  try {
    // Check if settings file exists
    if (fsSync.existsSync(settingsFilePath)) {
      // Load existing settings
      const data = await fs.readFile(settingsFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      settings = validateSettings(parsed);
      logInfo('Settings loaded', { path: settingsFilePath });
    } else {
      // Create default settings
      settings = { ...DEFAULT_SETTINGS };
      await saveSettings(settings);
      logInfo('Default settings created', { path: settingsFilePath });
    }
  } catch (error) {
    logError('Failed to load settings, using defaults', error);
    settings = { ...DEFAULT_SETTINGS };
    // Try to save default settings
    try {
      await saveSettings(settings);
    } catch (saveError) {
      logError('Failed to save default settings', saveError);
    }
  }

  return settings;
}

/**
 * Get current settings
 */
export function getSettings(): AppSettings {
  if (!settings) {
    throw new Error('Settings not initialized');
  }
  return { ...settings };
}

/**
 * Update settings
 */
export async function updateSettings(
  updates: Partial<AppSettings>
): Promise<AppSettings> {
  if (!settings) {
    throw new Error('Settings not initialized');
  }

  // Merge and validate
  const newSettings = validateSettings({ ...settings, ...updates });

  // Save to file
  await saveSettings(newSettings);

  settings = newSettings;
  logInfo('Settings updated', updates);

  return { ...settings };
}

/**
 * Save settings to file
 */
async function saveSettings(settingsToSave: AppSettings): Promise<void> {
  const dir = path.dirname(settingsFilePath);

  // Ensure directory exists
  if (!fsSync.existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }

  // Write settings file
  await fs.writeFile(
    settingsFilePath,
    JSON.stringify(settingsToSave, null, 2),
    'utf-8'
  );
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<AppSettings> {
  settings = { ...DEFAULT_SETTINGS };
  await saveSettings(settings);
  logWarn('Settings reset to defaults');
  return { ...settings };
}

/**
 * Get settings file path
 */
export function getSettingsFilePath(): string {
  return settingsFilePath;
}

/**
 * Export settings to file
 */
export async function exportSettings(exportPath: string): Promise<void> {
  if (!settings) {
    throw new Error('Settings not initialized');
  }
  await fs.writeFile(exportPath, JSON.stringify(settings, null, 2), 'utf-8');
  logInfo('Settings exported', { path: exportPath });
}

/**
 * Import settings from file
 */
export async function importSettings(importPath: string): Promise<AppSettings> {
  const data = await fs.readFile(importPath, 'utf-8');
  const parsed = JSON.parse(data);
  const imported = validateSettings(parsed);

  await saveSettings(imported);
  settings = imported;
  logInfo('Settings imported', { path: importPath });

  return { ...settings };
}
