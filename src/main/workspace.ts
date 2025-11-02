/**
 * @file workspace.ts
 * @brief ワークスペース構成と設定ファイルの管理を担当するモジュール。
 */

import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  type AppSettings,
  type AppSettingsPatch,
  defaultSettings,
  mergeSettings,
} from '../shared/settings';

export interface WorkspacePaths {
  root: string;
  inputDir: string;
  outputDir: string;
  logsDir: string;
  settingsFile: string;
}

const SAMPLE_INPUT_NAME = 'SampleDocument.md';
const SAMPLE_OUTPUT_NAME = 'SampleCards.json';

let cachedSettings: AppSettings | null = null;
let cachedPaths: WorkspacePaths | null = null;

const resolveWorkspacePaths = (): WorkspacePaths => {
  if (cachedPaths) {
    return cachedPaths;
  }

  const root = app.getPath('userData');
  cachedPaths = {
    root,
    inputDir: path.join(root, '_input'),
    outputDir: path.join(root, '_out'),
    logsDir: path.join(root, '_logs'),
    settingsFile: path.join(root, 'settings.json'),
  } satisfies WorkspacePaths;

  return cachedPaths;
};

const ensureDirectory = async (dir: string): Promise<void> => {
  await fs.mkdir(dir, { recursive: true });
};

const ensureFile = async (filePath: string, content: string): Promise<void> => {
  try {
    await fs.access(filePath);
  } catch (error) {
    await fs.writeFile(filePath, content, 'utf8');
  }
};

const createSampleFiles = async (paths: WorkspacePaths): Promise<void> => {
  const sampleInput = path.join(paths.inputDir, SAMPLE_INPUT_NAME);
  const sampleOutput = path.join(paths.outputDir, SAMPLE_OUTPUT_NAME);
  const sampleLog = path.join(paths.logsDir, `${new Date().toISOString().replace(/[:]/g, '').slice(0, 15)}_bootstrap.log`);

  await ensureFile(
    sampleInput,
    `# Sample Document\n\nこのファイルは mdsplitter のテスト用サンプルです。\n`,
  );

  await ensureFile(
    sampleOutput,
    JSON.stringify(
      {
        cards: [
          { id: 'sample-1', title: 'Sample Card', body: 'これはダミーカードです。', status: 'approved' },
        ],
      },
      null,
      2,
    ),
  );

  try {
    await fs.appendFile(
      sampleLog,
      `[${new Date().toISOString()}] INFO: ワークスペースを初期化しました。\n`,
      'utf8',
    );
  } catch (error) {
    console.warn('[workspace] failed to append sample log', error);
  }
};

const ensureSettingsFile = async (paths: WorkspacePaths): Promise<AppSettings> => {
  try {
    const raw = await fs.readFile(paths.settingsFile, 'utf8');
    const parsed = JSON.parse(raw) as AppSettingsPatch;
    cachedSettings = mergeSettings(defaultSettings, parsed);
  } catch (error) {
    cachedSettings = defaultSettings;
    await fs.writeFile(paths.settingsFile, JSON.stringify(defaultSettings, null, 2), 'utf8');
  }

  return cachedSettings;
};

export const initializeWorkspace = async (): Promise<WorkspacePaths> => {
  const paths = resolveWorkspacePaths();

  console.log('[workspace] userData path:', paths.root);

  await Promise.all([
    ensureDirectory(paths.root),
    ensureDirectory(paths.inputDir),
    ensureDirectory(paths.outputDir),
    ensureDirectory(paths.logsDir),
  ]);

  await createSampleFiles(paths);
  await ensureSettingsFile(paths);

  console.log('[workspace] initialized directories:', {
    input: paths.inputDir,
    output: paths.outputDir,
    logs: paths.logsDir,
    settings: paths.settingsFile,
  });

  return paths;
};

export const loadSettings = async (): Promise<AppSettings> => {
  if (cachedSettings) {
    return cachedSettings;
  }
  const paths = resolveWorkspacePaths();
  return ensureSettingsFile(paths);
};

export const updateSettings = async (patch: AppSettingsPatch): Promise<AppSettings> => {
  const current = await loadSettings();
  const next = mergeSettings(current, patch);
  cachedSettings = next;

  const paths = resolveWorkspacePaths();
  await fs.writeFile(paths.settingsFile, JSON.stringify(next, null, 2), 'utf8');
  return next;
};

export const getWorkspacePaths = (): WorkspacePaths => resolveWorkspacePaths();
