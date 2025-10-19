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
  input: {
    maxWarnSizeMB: 10,
    maxAbortSizeMB: 200,
  },
  file: {
    encodingFallback: 'reject',
    normalizeNewline: true,
  },
  converter: {
    strategy: 'rule',
    timeoutMs: 60000,
  },
  llm: {
    provider: 'none',
    temperature: 0,
    allowCloud: false,
  },
  log: {
    logLevel: 'info',
    logRotation: {
      maxFileSizeMB: 10,
      maxFiles: 5,
      retentionDays: 30,
    },
  },
  history: {
    maxDepth: 1000,
    perFile: false,
    persistOnExit: false,
  },
  ui: {
    theme: 'system',
    font: {
      size: 14,
    },
    window: {
      startMaximized: false,
    },
    autoSave: {
      enabled: true,
      intervalMs: 60000,
    },
  },
  concurrency: {
    fileLocking: 'optimistic',
    maxOpenFiles: 32,
  },
  workDir: '',
};

/**
 * Validate settings object
 * Note: This is a simplified validation. Complete validation will be added later.
 */
function validateSettings(data: unknown): AppSettings {
  const s = data as Partial<AppSettings>;

  // Deep merge with defaults
  const validated: AppSettings = {
    input: {
      maxWarnSizeMB: s.input?.maxWarnSizeMB ?? DEFAULT_SETTINGS.input.maxWarnSizeMB,
      maxAbortSizeMB: s.input?.maxAbortSizeMB ?? DEFAULT_SETTINGS.input.maxAbortSizeMB,
    },
    file: {
      encodingFallback: s.file?.encodingFallback ?? DEFAULT_SETTINGS.file.encodingFallback,
      normalizeNewline: s.file?.normalizeNewline ?? DEFAULT_SETTINGS.file.normalizeNewline,
    },
    converter: {
      strategy: s.converter?.strategy ?? DEFAULT_SETTINGS.converter.strategy,
      timeoutMs: s.converter?.timeoutMs ?? DEFAULT_SETTINGS.converter.timeoutMs,
    },
    llm: {
      provider: s.llm?.provider ?? DEFAULT_SETTINGS.llm.provider,
      endpoint: s.llm?.endpoint,
      model: s.llm?.model,
      temperature: s.llm?.temperature ?? DEFAULT_SETTINGS.llm.temperature,
      maxTokens: s.llm?.maxTokens,
      allowCloud: s.llm?.allowCloud ?? DEFAULT_SETTINGS.llm.allowCloud,
      redaction: s.llm?.redaction,
      apiKey: s.llm?.apiKey,
      timeoutMs: s.llm?.timeoutMs,
      maxConcurrency: s.llm?.maxConcurrency,
    },
    log: {
      logLevel: s.log?.logLevel ?? DEFAULT_SETTINGS.log.logLevel,
      logRotation: s.log?.logRotation ?? DEFAULT_SETTINGS.log.logRotation,
    },
    history: {
      maxDepth: s.history?.maxDepth ?? DEFAULT_SETTINGS.history.maxDepth,
      perFile: s.history?.perFile ?? DEFAULT_SETTINGS.history.perFile,
      persistOnExit: s.history?.persistOnExit ?? DEFAULT_SETTINGS.history.persistOnExit,
    },
    ui: {
      theme: s.ui?.theme ?? DEFAULT_SETTINGS.ui.theme,
      locale: s.ui?.locale,
      font: s.ui?.font ?? DEFAULT_SETTINGS.ui.font,
      window: s.ui?.window ?? DEFAULT_SETTINGS.ui.window,
      tab: s.ui?.tab,
      highlightColors: s.ui?.highlightColors,
      autoSave: s.ui?.autoSave ?? DEFAULT_SETTINGS.ui.autoSave,
    },
    trace: s.trace,
    fileWatcher: s.fileWatcher,
    search: s.search,
    concurrency: s.concurrency ?? DEFAULT_SETTINGS.concurrency,
    recentFiles: s.recentFiles,
    shortcuts: s.shortcuts,
    workDir: typeof s.workDir === 'string' ? s.workDir : DEFAULT_SETTINGS.workDir,
  };

  return validated;
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
