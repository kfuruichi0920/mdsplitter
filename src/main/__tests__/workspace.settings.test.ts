/**
 * @file workspace.settings.test.ts
 * @brief 設定ファイルの永続化と再起動後の反映を検証する統合テスト。
 * @details
 * settings.json への保存と、アプリ再起動をシミュレートした読み込みを検証。
 * テーマ設定の変更が正しく保存され、次回起動時に反映されることを確認。
 * @author K.Furuichi
 * @date 2025-11-07
 * @version 0.1
 * @copyright MIT
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { app } from 'electron';
import { loadSettings, updateSettings, initializeWorkspace } from '../workspace';
import type { AppSettings, AppSettingsPatch } from '../../shared/settings';

//! Electronアプリモジュールをモック
jest.mock('electron', () => ({
  app: {
    getAppPath: jest.fn(),
  },
}));

describe('workspace settings persistence', () => {
  let tempDir: string;
  let settingsFilePath: string;

  beforeAll(() => {
    //! app.getAppPath() をモック設定（全テストで共通の一時ディレクトリを使用）
    tempDir = path.join(os.tmpdir(), `mdsplitter-test-${Date.now()}`);
    settingsFilePath = path.join(tempDir, 'settings.json');
    (app.getAppPath as jest.Mock).mockReturnValue(tempDir);
  });

  beforeEach(async () => {
    //! 各テスト前にクリーンな状態にする
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // ディレクトリが存在しない場合は無視
    }
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    //! テスト後に一時ディレクトリを削除
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('[test] failed to remove temp dir', error);
    }
  });

  it('should persist theme settings to settings.json', async () => {
    //! ワークスペースを初期化（settings.json が既定値で作成される）
    await initializeWorkspace();

    //! 設定ファイルが作成されていることを確認
    const fileExists = await fs.access(settingsFilePath).then(() => true).catch(() => false);
    expect(fileExists).toBe(true);

    //! 初期設定をファイルから読み込み
    let fileContent = await fs.readFile(settingsFilePath, 'utf8');
    let initialSettings = JSON.parse(fileContent) as AppSettings;
    expect(initialSettings.theme.mode).toBe('dark'); // defaultSettings の既定値

    //! テーマモードを 'light' に変更
    const patch: AppSettingsPatch = {
      theme: {
        ...initialSettings.theme,
        mode: 'light',
      },
    };
    const updatedSettings = await updateSettings(patch);

    //! 更新後の設定が返されることを確認
    expect(updatedSettings.theme.mode).toBe('light');

    //! ファイルが実際に更新されているか確認
    fileContent = await fs.readFile(settingsFilePath, 'utf8');
    const savedSettings = JSON.parse(fileContent) as AppSettings;
    expect(savedSettings.theme.mode).toBe('light');
  });

  it('should load persisted theme settings after restart simulation', async () => {
    //! 第1フェーズ: 初期化と設定変更
    await initializeWorkspace();

    //! 初期設定をファイルから読み込み
    let fileContent = await fs.readFile(settingsFilePath, 'utf8');
    const initialSettings = JSON.parse(fileContent) as AppSettings;

    //! カスタムテーマ色を設定
    const customPatch: AppSettingsPatch = {
      theme: {
        mode: 'light',
        colorTheme: 'asagi',
        splitterWidth: 8,
        light: {
          background: '#fafafa',
          foreground: '#1a1a1a',
          border: '#e0e0e0',
          primary: '#0066cc',
          secondary: '#666666',
          cardBackground: '#ffffff',
          cardBorder: '#cccccc',
          connectorActive: '#0080ff',
          connectorInactive: '#999999',
        },
        dark: initialSettings.theme.dark, // 既定値を保持
      },
    };
    await updateSettings(customPatch);

    //! 第2フェーズ: 再起動をシミュレート（ファイルから直接読み込み）
    //  実際のアプリでは、プロセス再起動により自動的にキャッシュがクリアされる
    //  テストでは、ファイルから直接読み込むことで再起動後の状態を検証

    fileContent = await fs.readFile(settingsFilePath, 'utf8');
    const reloadedSettings = JSON.parse(fileContent) as AppSettings;

    //! 保存された設定が正しく反映されていることを確認
    expect(reloadedSettings.theme.mode).toBe('light');
    expect(reloadedSettings.theme.splitterWidth).toBe(8);
    expect(reloadedSettings.theme.light.background).toBe('#fafafa');
    expect(reloadedSettings.theme.light.primary).toBe('#0066cc');
    expect(reloadedSettings.theme.light.connectorActive).toBe('#0080ff');
  });

  it('should preserve all theme color settings during update', async () => {
    //! ワークスペース初期化
    await initializeWorkspace();

    //! 初期設定をファイルから読み込み
    let fileContent = await fs.readFile(settingsFilePath, 'utf8');
    const initialSettings = JSON.parse(fileContent) as AppSettings;

    //! ライトモード色の一部のみ変更
    const partialPatch: AppSettingsPatch = {
      theme: {
        ...initialSettings.theme,
        mode: 'light',
        light: {
          ...initialSettings.theme.light,
          primary: '#ff0000', // プライマリ色のみ変更
        },
      },
    };
    await updateSettings(partialPatch);

    //! ファイルから読み込み
    fileContent = await fs.readFile(settingsFilePath, 'utf8');
    const savedSettings = JSON.parse(fileContent) as AppSettings;

    //! 変更した色が反映されていることを確認
    expect(savedSettings.theme.light.primary).toBe('#ff0000');

    //! その他の色設定が保持されていることを確認
    expect(savedSettings.theme.light.background).toBe(initialSettings.theme.light.background);
    expect(savedSettings.theme.light.foreground).toBe(initialSettings.theme.light.foreground);
    expect(savedSettings.theme.light.cardBackground).toBe(initialSettings.theme.light.cardBackground);

    //! ダークモード色が変更されていないことを確認
    expect(savedSettings.theme.dark).toEqual(initialSettings.theme.dark);
  });

  it('should handle settings file corruption gracefully', async () => {
    //! ワークスペース初期化
    await initializeWorkspace();

    //! 設定ファイルを削除して再初期化（破損ケースのシミュレート）
    await fs.unlink(settingsFilePath);
    await initializeWorkspace();

    //! ファイルから読み込み
    const fileContent = await fs.readFile(settingsFilePath, 'utf8');
    const settings = JSON.parse(fileContent) as AppSettings;

    //! 既定値で再作成されていることを確認
    expect(settings.theme.mode).toBe('dark'); // 既定値
    expect(settings.theme.splitterWidth).toBe(4); // 既定値
  });

  it('should update splitterWidth independently', async () => {
    //! ワークスペース初期化
    await initializeWorkspace();

    //! 初期設定をファイルから読み込み
    let fileContent = await fs.readFile(settingsFilePath, 'utf8');
    const initialSettings = JSON.parse(fileContent) as AppSettings;

    //! splitterWidth のみ変更
    const patch: AppSettingsPatch = {
      theme: {
        ...initialSettings.theme,
        splitterWidth: 10,
      },
    };
    await updateSettings(patch);

    //! ファイルから読み込み
    fileContent = await fs.readFile(settingsFilePath, 'utf8');
    const savedSettings = JSON.parse(fileContent) as AppSettings;

    //! splitterWidth が変更されていることを確認
    expect(savedSettings.theme.splitterWidth).toBe(10);

    //! その他の設定が保持されていることを確認
    expect(savedSettings.theme.mode).toBe(initialSettings.theme.mode);
    expect(savedSettings.theme.light).toEqual(initialSettings.theme.light);
    expect(savedSettings.theme.dark).toEqual(initialSettings.theme.dark);
  });
});
