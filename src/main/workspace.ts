/**
 * @file workspace.ts
 * @brief ワークスペース構成と設定ファイルの管理を担当するモジュール。
 * @details
 * Electronアプリのユーザーデータディレクトリ配下で、設定・入出力・ログ・カードファイルの管理を行う。
 * 制約: ディレクトリ/ファイル生成失敗時はcatchで握りつぶす。@todo サンプルファイル生成のカスタマイズ。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
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
import {
  WORKSPACE_SNAPSHOT_FILENAME,
  isWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from '../shared/workspace';
import {
  isTraceabilityFile,
  normalizeDirection,
  type LoadedTraceabilityFile,
  type TraceabilityFile,
  type TraceabilityLink,
} from '../shared/traceability';

export interface WorkspacePaths {
  root: string;
  inputDir: string;
  outputDir: string;
  logsDir: string;
  settingsFile: string;
}

const SAMPLE_INPUT_NAME = 'SampleDocument.md';
const SAMPLE_OUTPUT_NAME = 'SampleCards.json';
const JSON_EXTENSION = '.json';
let cachedSettings: AppSettings | null = null;
let cachedPaths: WorkspacePaths | null = null;

/**
 * @brief ワークスペース関連ディレクトリ・ファイルパスを解決する。
 * @details
 * 実行フォルダ（app.getAppPath()）をベースに各種ディレクトリ・ファイルパスを構築。
 * _input, _out, _logs は実行フォルダ直下に配置される。
 * @return WorkspacePaths型のパス情報。
 * @throws なし
 */
const resolveWorkspacePaths = (): WorkspacePaths => {
  //! 既にキャッシュ済みなら再計算せず返す
  if (cachedPaths) {
    return cachedPaths;
  }
  //! 実行フォルダをベースパスとして取得
  const root = app.getAppPath();
  //! 各種サブディレクトリ・ファイルパスを構築
  cachedPaths = {
    root,
    inputDir: path.join(root, '_input'),
    outputDir: path.join(root, '_out'),
    logsDir: path.join(root, '_logs'),
    settingsFile: path.join(root, 'settings.json'),
  } satisfies WorkspacePaths;
  return cachedPaths;
};

/**
 * @brief ディレクトリの存在を保証する。
 * @details
 * 存在しない場合は再帰的に作成。
 * @param dir ディレクトリパス。
 * @return なし。
 * @throws なし（mkdir失敗時は上位でcatch）
 */
const ensureDirectory = async (dir: string): Promise<void> => {
  //! ディレクトリが存在しない場合は再帰的に作成
  await fs.mkdir(dir, { recursive: true });
};

/**
 * @brief ファイルの存在を保証する。
 * @details
 * 存在しない場合は指定内容で新規作成。
 * @param filePath ファイルパス。
 * @param content 初期内容。
 * @return なし。
 * @throws なし（write失敗時は上位でcatch）
 */
const ensureFile = async (filePath: string, content: string): Promise<void> => {
  try {
    //! ファイルが存在するか確認
    await fs.access(filePath);
  } catch (error) {
    //! 存在しなければ初期内容で新規作成
    await fs.writeFile(filePath, content, 'utf8');
  }
};

/**
 * @brief サンプル入出力ファイル・ログを生成する。
 * @details
 * 初回起動時にテスト用サンプルファイルを作成。
 * @param paths ワークスペースパス情報。
 * @return なし。
 * @throws なし（ファイル生成失敗時はcatchで警告）
 */
const createSampleFiles = async (paths: WorkspacePaths): Promise<void> => {
  //! サンプル入出力ファイル・ログのパスを生成
  const sampleInput = path.join(paths.inputDir, SAMPLE_INPUT_NAME);
  const sampleOutput = path.join(paths.outputDir, SAMPLE_OUTPUT_NAME);
  const sampleLog = path.join(paths.logsDir, `${new Date().toISOString().replace(/[:]/g, '').slice(0, 15)}_bootstrap.log`);

  //! サンプル入力ファイルを作成（存在しなければ）
  await ensureFile(
    sampleInput,
    `# Sample Document\n\nこのファイルは mdsplitter のテスト用サンプルです。\n`,
  );

  //! サンプル出力ファイルを作成（存在しなければ）
  await ensureFile(
    sampleOutput,
    JSON.stringify(
      {
        cards: [
          {
            id: 'sample-1',
            title: 'はじめに',
            body: 'この文書はmdsplitterのサンプルです。',
            status: 'approved',
            kind: 'heading',
            hasLeftTrace: false,
            hasRightTrace: false,
            updatedAt: new Date().toISOString(),
            parent_id: null,
            child_ids: ['sample-2', 'sample-3'],
            prev_id: null,
            next_id: 'sample-4',
            level: 0,
          },
          {
            id: 'sample-2',
            title: '概要',
            body: 'カード編集機能の概要です。',
            status: 'draft',
            kind: 'paragraph',
            hasLeftTrace: false,
            hasRightTrace: false,
            updatedAt: new Date().toISOString(),
            parent_id: 'sample-1',
            child_ids: [],
            prev_id: null,
            next_id: 'sample-3',
            level: 1,
          },
          {
            id: 'sample-3',
            title: '機能一覧',
            body: '主な機能を説明します。',
            status: 'review',
            kind: 'paragraph',
            hasLeftTrace: false,
            hasRightTrace: false,
            updatedAt: new Date().toISOString(),
            parent_id: 'sample-1',
            child_ids: [],
            prev_id: 'sample-2',
            next_id: null,
            level: 1,
          },
          {
            id: 'sample-4',
            title: '操作方法',
            body: '基本的な操作方法を説明します。',
            status: 'approved',
            kind: 'heading',
            hasLeftTrace: false,
            hasRightTrace: false,
            updatedAt: new Date().toISOString(),
            parent_id: null,
            child_ids: ['sample-5'],
            prev_id: 'sample-1',
            next_id: null,
            level: 0,
          },
          {
            id: 'sample-5',
            title: 'カード選択',
            body: 'カードをクリックして選択します。',
            status: 'draft',
            kind: 'paragraph',
            hasLeftTrace: false,
            hasRightTrace: false,
            updatedAt: new Date().toISOString(),
            parent_id: 'sample-4',
            child_ids: [],
            prev_id: null,
            next_id: null,
            level: 1,
          },
        ],
        savedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  try {
    //! サンプルログファイルに初期化メッセージを追記
    await fs.appendFile(
      sampleLog,
      `[${new Date().toISOString()}] INFO: ワークスペースを初期化しました。\n`,
      'utf8',
    );
  } catch (error) {
    //! ログ追記失敗時は警告のみ
    console.warn('[workspace] failed to append sample log', error);
  }
};

/**
 * @brief 設定ファイルの存在を保証し、内容を読み込む。
 * @details
 * 存在しない場合は既定値で新規作成。内容はキャッシュ。
 * @param paths ワークスペースパス情報。
 * @return AppSettings型の設定オブジェクト。
 * @throws なし（ファイル生成失敗時はcatchで握りつぶす）
 */
const ensureSettingsFile = async (paths: WorkspacePaths): Promise<AppSettings> => {
  try {
    //! 設定ファイルを読み込み、パースしてキャッシュ
    const raw = await fs.readFile(paths.settingsFile, 'utf8');
    const parsed = JSON.parse(raw) as AppSettingsPatch;
    cachedSettings = mergeSettings(defaultSettings, parsed);
  } catch (error) {
    //! ファイルが存在しない/パース失敗時は既定値で新規作成
    cachedSettings = defaultSettings;
    await fs.writeFile(paths.settingsFile, JSON.stringify(defaultSettings, null, 2), 'utf8');
  }
  return cachedSettings;
};

/**
 * @brief ワークスペースの初期化処理。
 * @details
 * ディレクトリ・サンプルファイル・設定ファイルを生成し、パス情報を返す。
 * @return WorkspacePaths型のパス情報。
 * @throws なし（失敗時は警告出力のみ）
 */
export const initializeWorkspace = async (): Promise<WorkspacePaths> => {
  //! ワークスペースパス情報を取得
  const paths = resolveWorkspacePaths();
  console.log('[workspace] application root path:', paths.root);
  //! 必要なディレクトリを全て作成（並列実行）
  await Promise.all([
    ensureDirectory(paths.root),
    ensureDirectory(paths.inputDir),
    ensureDirectory(paths.outputDir),
    ensureDirectory(paths.logsDir),
  ]);
  //! サンプルファイル群を生成
  await createSampleFiles(paths);
  //! 設定ファイルの存在保証＆読込
  await ensureSettingsFile(paths);
  //! 初期化完了ログ出力
  console.log('[workspace] initialized directories:', {
    input: paths.inputDir,
    output: paths.outputDir,
    logs: paths.logsDir,
    settings: paths.settingsFile,
  });
  return paths;
};

/**
 * @brief 設定ファイルを読み込む。
 * @details
 * キャッシュがあればそれを返す。なければファイルから読込。
 * @return AppSettings型の設定オブジェクト。
 * @throws なし
 */
export const loadSettings = async (): Promise<AppSettings> => {
  //! キャッシュ済みなら即返す
  if (cachedSettings) {
    return cachedSettings;
  }
  //! 未キャッシュ時はファイルから読込
  const paths = resolveWorkspacePaths();
  return ensureSettingsFile(paths);
};

/**
 * @brief 設定ファイルを更新する。
 * @details
 * patchで指定された内容を既存設定にマージし、ファイルへ保存。
 * @param patch 上書きする設定。
 * @return 更新後のAppSettings。
 * @throws なし（ファイル書き込み失敗時はcatchで握りつぶす）
 */
export const updateSettings = async (patch: AppSettingsPatch): Promise<AppSettings> => {
  //! 現在の設定を取得
  const current = await loadSettings();
  //! patch内容をマージ
  const next = mergeSettings(current, patch);
  //! キャッシュ更新
  cachedSettings = next;
  //! 設定ファイルへ保存
  const paths = resolveWorkspacePaths();
  await fs.writeFile(paths.settingsFile, JSON.stringify(next, null, 2), 'utf8');
  return next;
};

/**
 * @brief 現在のワークスペースパス情報を取得。
 * @details
 * resolveWorkspacePathsのラッパー。
 * @return WorkspacePaths型。
 * @throws なし
 */
export const getWorkspacePaths = (): WorkspacePaths => resolveWorkspacePaths(); ////! ラッパー関数

/**
 * @brief ワークスペーススナップショットを保存する。
 * @details
 * outputDir配下にJSON形式で保存。
 * @param snapshot 保存するスナップショット。
 * @return 保存先ファイルパス。
 * @throws なし（ファイル書き込み失敗時はcatchで握りつぶす）
 */
export const saveWorkspaceSnapshot = async (snapshot: WorkspaceSnapshot): Promise<string> => {
  //! 保存先ファイルパスを決定
  const paths = resolveWorkspacePaths();
  const filePath = path.join(paths.outputDir, WORKSPACE_SNAPSHOT_FILENAME);
  //! スナップショットをJSON形式で保存
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  return filePath;
};

const normalizeOutputFileName = (fileName: string): string => {
  const trimmed = fileName?.trim?.() ?? '';
  if (!trimmed) {
    throw new Error('保存ファイル名が指定されていません。');
  }
  if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
    throw new Error('ファイル名に使用できない文字が含まれています。');
  }
  return trimmed.toLowerCase().endsWith(JSON_EXTENSION) ? trimmed : `${trimmed}${JSON_EXTENSION}`;
};

export const saveCardFileSnapshot = async (fileName: string, snapshot: WorkspaceSnapshot): Promise<string> => {
  const safeName = normalizeOutputFileName(fileName);
  const paths = resolveWorkspacePaths();
  const filePath = path.join(paths.outputDir, safeName);
  await fs.writeFile(filePath, JSON.stringify(snapshot, null, 2), 'utf8');
  return filePath;
};

/**
 * @brief ワークスペーススナップショットを読み込む。
 * @details
 * outputDir配下のJSONファイルをパースし、妥当性検証。
 * @return WorkspaceSnapshot型またはnull。
 * @throws なし（ファイル読込失敗時はcatchで握りつぶす）
 */
export const loadWorkspaceSnapshot = async (): Promise<WorkspaceSnapshot | null> => {
  //! 読み込み対象ファイルパスを決定
  const paths = resolveWorkspacePaths();
  const filePath = path.join(paths.outputDir, WORKSPACE_SNAPSHOT_FILENAME);
  try {
    //! ファイル内容を読込・パース
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    //! 構造妥当性検証
    if (isWorkspaceSnapshot(parsed)) {
      return parsed;
    }
    //! 不正構造の場合は警告
    console.warn('[workspace] invalid snapshot structure, ignoring');
    return null;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    //! ファイル未存在ならnull返却
    if (err?.code === 'ENOENT') {
      return null;
    }
    //! その他の読込失敗はエラーログ
    console.error('[workspace] failed to load snapshot', error);
    return null;
  }
};

/**
 * @brief _inputディレクトリ内のカードファイル一覧を取得する。
 * @return カードファイル名の配列。
 */
export const listCardFiles = async (): Promise<string[]> => {
  //! _inputディレクトリのファイル一覧を取得
  const paths = resolveWorkspacePaths();
  try {
    const entries = await fs.readdir(paths.inputDir, { withFileTypes: true });
    //! .json拡張子のファイルのみ抽出・ソート
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort();
    return jsonFiles;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    //! ディレクトリ未存在なら空配列返却
    if (err?.code === 'ENOENT') {
      return [];
    }
    //! その他の失敗はエラーログ＋再throw
    console.error('[workspace] failed to list card files', error);
    throw error;
  }
};

/**
 * @brief _outディレクトリ内のカードファイル一覧を取得する。
 * @details
 * outputDir配下の.json拡張子ファイルをアルファベット順でソート。
 * @return ファイル名の配列（拡張子含む）。
 * @throws ディレクトリアクセス失敗時（ENOENT以外）。
 */
export const listOutputFiles = async (): Promise<string[]> => {
  const paths = resolveWorkspacePaths();
  try {
    const entries = await fs.readdir(paths.outputDir, { withFileTypes: true });
    const jsonFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort();
    return jsonFiles;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ENOENT') {
      return [];
    }
    console.error('[workspace] failed to list output files', error);
    throw error;
  }
};

/**
 * @brief 指定されたカードファイルを読み込む。
 * @param fileName ファイル名（_inputディレクトリ内の相対パス）。
 * @return カードスナップショット、または null（無効な構造の場合）。
 */
export const loadCardFile = async (fileName: string): Promise<WorkspaceSnapshot | null> => {
  //! ワークスペースパス情報を取得
  const paths = resolveWorkspacePaths();
  //! パストラバーサル対策: ファイル名にディレクトリ区切り文字が含まれていないことを確認
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    console.warn('[workspace] invalid file name, rejecting:', fileName);
    return null;
  }

  //! 対象ファイルパスを構築
  const filePath = path.join(paths.inputDir, fileName);
  try {
    //! ファイル内容を読込・パース
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    //! 構造妥当性検証
    if (isWorkspaceSnapshot(parsed)) {
      return parsed;
    }
    //! 不正構造の場合は警告
    console.warn('[workspace] invalid card file structure:', fileName);
    return null;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    //! ファイル未存在ならnull返却
    if (err?.code === 'ENOENT') {
      return null;
    }
    //! その他の読込失敗はエラーログ
    console.error('[workspace] failed to load card file', error);
    return null;
  }
};

/**
 * @brief _outディレクトリから指定されたカードファイルを読み込む。
 * @param fileName ファイル名（_outディレクトリ内の相対パス）。
 * @return カードスナップショット、または null（無効な構造の場合）。
 */
export const loadOutputFile = async (fileName: string): Promise<WorkspaceSnapshot | null> => {
  //! ワークスペースパス情報を取得
  const paths = resolveWorkspacePaths();
  //! パストラバーサル対策: ファイル名にディレクトリ区切り文字が含まれていないことを確認
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    console.warn('[workspace] invalid file name, rejecting:', fileName);
    return null;
  }

  //! 対象ファイルパスを構築
  const filePath = path.join(paths.outputDir, fileName);
  try {
    //! ファイル内容を読込・パース
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    //! 構造妥当性検証
    if (isWorkspaceSnapshot(parsed)) {
      return parsed;
    }
    //! 不正構造の場合は警告
    console.warn('[workspace] invalid card file structure:', fileName);
    return null;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    //! ファイル未存在なら警告＋null返却
    if (err?.code === 'ENOENT') {
      console.warn('[workspace] card file not found:', fileName);
      return null;
    }
    //! その他の読込失敗はエラーログ＋再throw
    console.error('[workspace] failed to load card file:', fileName, error);
    throw error;
  }
};

const isSafeFileToken = (token: string): boolean => {
  return !token.includes('/') && !token.includes('\\') && !token.includes('..');
};

/**
 * @brief 指定されたカードファイルペアに対応するトレーサビリティファイルを読み込む。
 * @param leftFile 左側カードファイル名。
 * @param rightFile 右側カードファイル名。
 * @return 一致するファイルがあれば内容、なければ null。
 */
export const loadTraceFile = async (
  leftFile: string,
  rightFile: string,
): Promise<LoadedTraceabilityFile | null> => {
  if (!isSafeFileToken(leftFile) || !isSafeFileToken(rightFile)) {
    console.warn('[workspace] invalid trace file request tokens');
    return null;
  }

  const paths = resolveWorkspacePaths();
  let candidates: string[] = [];
  try {
    const entries = await fs.readdir(paths.outputDir, { withFileTypes: true });
    candidates = entries
      .filter((entry) => entry.isFile() && entry.name.startsWith('trace_') && entry.name.endsWith('.json'))
      .map((entry) => entry.name);
  } catch (error) {
    console.error('[workspace] failed to enumerate trace files', error);
    return null;
  }

  for (const candidate of candidates) {
    const filePath = path.join(paths.outputDir, candidate);
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as TraceabilityFile;
      if (!isTraceabilityFile(parsed)) {
        console.warn('[workspace] invalid traceability file structure:', candidate);
        continue;
      }

      const matches =
        (parsed.left_file === leftFile && parsed.right_file === rightFile) ||
        (parsed.left_file === rightFile && parsed.right_file === leftFile);
      if (!matches) {
        continue;
      }

      return {
        fileName: candidate,
        payload: parsed,
      } satisfies LoadedTraceabilityFile;
    } catch (error) {
      console.error('[workspace] failed to load trace file:', candidate, error);
    }
  }

  return null;
};
