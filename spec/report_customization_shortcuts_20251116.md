# カスタマイズ性と操作性向上の検討レポート

**作成日:** 2025年11月16日
**対象:** mdsplitter (カード編集アプリケーション)
**バージョン:** 0.4 (claude/improve-customization-shortcuts-01YAVpktUScGyXXYstg2cXC4)

---

## 1. エグゼクティブサマリー

本レポートは、mdsplitterアプリケーションのカスタマイズ性と操作性（特にショートカットキー）の向上を目的とした検討結果をまとめたものです。

### 主要な発見事項

1. **現状の実装:** 基本的なショートカットキー（保存、コピー/ペースト、Undo/Redo等）は実装済み
2. **未実装機能:** カード選択・移動系のショートカット、タブ切り替え、フォントカスタマイズ機能が未実装
3. **改善の方向性:** グローバルショートカットとコンテキスト依存ショートカットの明確な分離、フォント・テーマのカスタマイズ強化
4. **実現可能性:** 既存のReact/TypeScript/Zustand基盤を活用し、段階的な実装が可能

---

## 2. プロジェクト概要

### 2.1. アプリケーションの目的

mdsplitterは、仕様書/設計書/議事録等の自然言語文書を「カード」に分割し、以下を実現するElectronデスクトップアプリケーションです：

- **構造化:** 非構造化データを階層構造を持つカードに変換
- **トレーサビリティ管理:** カード間の関係性を可視化・編集
- **生成AI活用の拡張:** 構造化データにより上流工程での生成AI活用を促進

### 2.2. 技術スタック

- **フロントエンド:** React 18 + TypeScript + Zustand (状態管理)
- **デスクトップ:** Electron 32系
- **スタイリング:** Tailwind CSS
- **実行環境:** Node.js 22.20.0

---

## 3. 現状分析

### 3.1. 実装済み機能

#### 3.1.1. グローバルショートカットキー

| ショートカット | 機能 | 実装箇所 |
|--------------|------|----------|
| `Ctrl+S` | 上書き保存 | App.tsx:2667-2674 |
| `Ctrl+Shift+S` | 別名保存 | App.tsx:2667-2674 |
| `Ctrl+C` | コピー | App.tsx:2585-2603 |
| `Ctrl+V` | ペースト | App.tsx:2606-2626 |
| `Ctrl+Z` | Undo | App.tsx:2629-2645 |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo | App.tsx:2648-2664 |
| `Ctrl+F` | 検索パネルを開く | App.tsx:2677-2680 |
| `Ctrl+B` | サイドバー表示切替 | App.tsx:2683-2686 |
| `Ctrl+L` | ログエリア表示切替 | App.tsx:2689-2692 |
| `Ctrl+\` | 左右分割 | App.tsx:2695-2698 |
| `Ctrl+Shift+\` | 上下分割 | App.tsx:2701-2704 |
| `Ctrl+,` | 設定ダイアログを開く | App.tsx:2580-2583 |
| `Ctrl+Alt+↑` | 選択カードの前にカード追加 | App.tsx:2711-2714 |
| `Ctrl+Alt+↓` | 選択カードの後にカード追加 | App.tsx:2716-2719 |
| `Ctrl+Alt+→` | 選択カードの子としてカード追加 | App.tsx:2721-2724 |
| `Insert` | カード追加 | App.tsx:2737-2740 |
| `Delete` | カード削除 | App.tsx:2743-2764 |
| `Escape` | ダイアログを閉じる | 各ダイアログコンポーネント |

#### 3.1.2. カード編集時のショートカット

| ショートカット | 機能 | 実装箇所 |
|--------------|------|----------|
| `Escape` | 編集キャンセル | CardPanel.tsx:1877-1879 |
| `Ctrl+Enter` | 編集を保存 | CardPanel.tsx:1880-1882 |

#### 3.1.3. カスタマイズ機能

現在の設定ファイル (`src/shared/settings.ts`) には以下のカスタマイズ項目があります：

- **テーマ設定:**
  - モード選択: light / dark / system
  - 分割境界の幅: splitterWidth (px)
  - カラーテーマ: 背景色、前景色、境界色、プライマリ色、カード色、コネクタ色など

- **入力設定:**
  - ファイルサイズ警告/中断閾値
  - 文字エンコーディングフォールバック
  - 改行正規化

- **ログ設定:**
  - ログレベル
  - ローテーションサイズ・世代数

### 3.2. 未実装機能

#### 3.2.1. 提案されたショートカットキー

| ショートカット | 提案機能 | 状態 |
|--------------|----------|------|
| `Ctrl+A` | アクティブカードファイルの全カードを選択 | **未実装** |
| `Ctrl+W` | アクティブカードファイル（タブ）を閉じる | **未実装** |
| `↑` / `↓` | カード間の移動（選択カードを変更） | **未実装** |
| `→` / `←` | 階層の展開/折りたたみ | **部分実装** (マウスのみ) |
| `Shift+↑` / `Shift+↓` | カードの連続選択 | **未実装** |
| `Ctrl+Tab` | アクティブタブを順番に選択 | **未実装** |
| `Ctrl+Shift+Tab` | アクティブタブを逆順に選択 | **未実装** |
| `Ctrl+M` | マトリクス画面を開く | **未実装** |

#### 3.2.2. 提案されたUI改善

| 機能 | 状態 |
|------|------|
| フォントサイズのカスタマイズ設定 | **未実装** |
| フォントファミリーのカスタマイズ設定 | **未実装** |
| `Ctrl+マウスホイール` でフォントサイズ変更 | **未実装** |
| 余白の最小化設定 | **部分実装** (コンパクトモードあり) |
| マトリクス画面のカラーテーマ連動 | **要確認** |

---

## 4. 提案内容の詳細分析

### 4.1. 既存提案の整理

#### 4.1.1. UI改善項目

**1. フォントカスタマイズ**
- **目的:** ユーザーの視認性向上、アクセシビリティ対応
- **提案内容:**
  - フォントサイズのカスタマイズ可能化
  - フォントファミリーのカスタマイズ可能化
  - `Ctrl+マウスホイール` でのリアルタイムサイズ変更
- **期待効果:**
  - 視覚障害のあるユーザーへの対応
  - 個人の好みに応じた読みやすさの向上
  - プレゼンテーション時の柔軟な表示調整

**2. 余白の最小化**
- **目的:** 画面の情報密度向上
- **提案内容:**
  - カード表示の余白を最小限に
  - マトリクス表示の余白を最小限に
- **期待効果:**
  - 一度に表示できるカード数の増加
  - スクロール操作の削減
  - 全体像の把握が容易に

**3. テーマ連動**
- **目的:** UI一貫性の向上
- **提案内容:**
  - マトリクス画面のカラーテーマをカード画面と連動
- **期待効果:**
  - 統一感のあるUI体験
  - 設定の重複管理を回避

#### 4.1.2. ショートカットキー改善項目

**1. グローバルとコンテキスト依存の明確化**
- **目的:** ショートカットの競合回避、直感的な操作体系
- **提案内容:**
  - グローバルショートカット: アプリケーション全体で有効
  - カード内ショートカット: カード操作時のみ有効（編集時など）
  - カードパネルショートカット: アクティブなカードファイルで有効

**2. 具体的なショートカット**

| カテゴリ | ショートカット | 機能 | 優先度 |
|---------|--------------|------|--------|
| **ファイル操作** | `Ctrl+A` | アクティブカードファイルの全カード選択 | 高 |
| | `Ctrl+W` | アクティブタブを閉じる | 高 |
| **カード移動** | `↑` / `↓` | カード選択を上下に移動 | 高 |
| | `→` / `←` | 階層の展開/折りたたみ | 高 |
| | `Shift+↑` / `Shift+↓` | カードの連続選択 | 中 |
| **タブ操作** | `Ctrl+Tab` | 次のタブへ移動 | 高 |
| | `Ctrl+Shift+Tab` | 前のタブへ移動 | 高 |
| **画面切替** | `Ctrl+M` | マトリクス画面を開く | 中 |

### 4.2. 新規提案項目

本ツールの目的（非構造化データの構造化とトレーサビリティ管理）を踏まえた追加提案：

#### 4.2.1. キーボードナビゲーションの強化

**1. カード階層操作の拡張**
- **提案:**
  - `Ctrl+→` / `Ctrl+←`: 選択カードの階層レベルを変更（インデント/アウトデント）
  - `Ctrl+Shift+→`: 選択カードを子カードとして移動
  - `Home` / `End`: 同階層の最初/最後のカードへジャンプ
  - `Ctrl+Home` / `Ctrl+End`: ドキュメントの最初/最後のカードへジャンプ

**2. トレーサビリティナビゲーション**
- **提案:**
  - `Alt+→` / `Alt+←`: トレース先のカードへジャンプ（左右パネル間移動）
  - `Alt+↑` / `Alt+↓`: 同じトレースグループ内の次/前のカードへ移動
  - `Ctrl+Alt+T`: 選択カードのトレース関係をハイライト表示

**3. 検索・フィルタ操作**
- **提案:**
  - `F3` / `Shift+F3`: 検索結果の次/前へ移動
  - `Ctrl+Shift+F`: カード種別フィルタの切り替え
  - `/`: クイック検索（カードパネル内）

#### 4.2.3. フォント・表示カスタマイズの拡張

**1. フォント設定の詳細化**
- **提案:**
  - カード種別ごとのフォントサイズ設定（見出し、段落、コードなど）
  - 等幅フォントと可変幅フォントの使い分け
  - 行間（line-height）の調整
  - 字間（letter-spacing）の調整

**2. ズーム機能**
- **提案:**
  - `Ctrl+マウスホイール`: カードパネル全体のズーム
  - `Ctrl+0`: ズームをリセット
  - `Ctrl++` / `Ctrl+-`: キーボードでズーム調整
  - ズームレベルの保存（パネルごと、またはグローバル）

**3. カード表示オプション**
- **提案:**
  - カード間のスペーシング調整
  - カード境界線の太さ・スタイル調整
  - 階層インデント幅の調整
  - アイコンサイズの調整

#### 4.2.6. エクスポート・共有機能

**1. ショートカットキーマップのエクスポート**
- **提案:**
  - `Ctrl+Shift+K`: ショートカット一覧を表示

**2. カスタマイズ設定の共有**
- **提案:**
  - 設定のエクスポート/インポート（JSON）

---

## 5. 実現方法と技術検討

### 5.1. 実装アーキテクチャ

#### 5.1.1. ショートカットキー管理システム

**設計方針:**
- **集中管理:** 単一のショートカットマネージャーで全体を制御
- **優先度制御:** グローバル < パネル < ダイアログ の優先順位
- **カスタマイズ対応:** 設定ファイルからのキーバインド読み込み

**実装構成:**

```typescript
// src/renderer/utils/shortcutManager.ts

export interface ShortcutAction {
  id: string;
  category: 'global' | 'panel' | 'card' | 'dialog';
  defaultKey: string;
  description: string;
  handler: () => void;
  condition?: () => boolean; // 実行可能条件
}

export interface ShortcutConfig {
  actions: Record<string, string>; // actionId -> keyBinding
}

export class ShortcutManager {
  private actions: Map<string, ShortcutAction>;
  private config: ShortcutConfig;
  private listeners: Map<string, Set<() => void>>;

  register(action: ShortcutAction): void;
  unregister(actionId: string): void;
  handleKeyDown(event: KeyboardEvent): boolean;
  updateBinding(actionId: string, newKey: string): void;
  getConflicts(key: string): ShortcutAction[];
  exportConfig(): ShortcutConfig;
  importConfig(config: ShortcutConfig): void;
}
```

**統合方法:**
```typescript
// App.tsx内での利用例
const shortcutManager = useShortcutManager();

useEffect(() => {
  shortcutManager.register({
    id: 'save',
    category: 'global',
    defaultKey: 'Ctrl+S',
    description: 'ファイルを保存',
    handler: handleSave,
  });

  shortcutManager.register({
    id: 'closeTab',
    category: 'panel',
    defaultKey: 'Ctrl+W',
    description: 'アクティブタブを閉じる',
    handler: handleCloseTab,
    condition: () => activeTabId !== null,
  });

  // ...
}, []);
```

#### 5.1.2. フォント・ズーム管理システム

**設計方針:**
- **リアルタイム反映:** CSS変数を利用したライブアップデート
- **範囲制限:** 最小/最大値の設定
- **保存:** ローカルストレージまたは設定ファイルへの永続化

**実装構成:**

```typescript
// src/renderer/store/fontStore.ts (Zustand)

export interface FontSettings {
  baseFontSize: number; // 基準フォントサイズ (px)
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  cardSpacing: number;
  zoom: number; // ズームレベル (%)
}

export interface FontStore extends FontSettings {
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setZoom: (zoom: number) => void;
  incrementZoom: () => void;
  decrementZoom: () => void;
  resetZoom: () => void;
  applyToDOM: () => void;
}

export const useFontStore = create<FontStore>((set, get) => ({
  baseFontSize: 14,
  fontFamily: 'system-ui',
  lineHeight: 1.5,
  letterSpacing: 0,
  cardSpacing: 8,
  zoom: 100,

  setFontSize: (size) => {
    set({ baseFontSize: Math.max(8, Math.min(32, size)) });
    get().applyToDOM();
  },

  setZoom: (zoom) => {
    set({ zoom: Math.max(50, Math.min(200, zoom)) });
    get().applyToDOM();
  },

  incrementZoom: () => {
    const newZoom = get().zoom + 10;
    get().setZoom(newZoom);
  },

  decrementZoom: () => {
    const newZoom = get().zoom - 10;
    get().setZoom(newZoom);
  },

  resetZoom: () => {
    get().setZoom(100);
  },

  applyToDOM: () => {
    const { baseFontSize, fontFamily, lineHeight, letterSpacing, zoom } = get();
    const root = document.documentElement;
    root.style.setProperty('--base-font-size', `${baseFontSize}px`);
    root.style.setProperty('--font-family', fontFamily);
    root.style.setProperty('--line-height', String(lineHeight));
    root.style.setProperty('--letter-spacing', `${letterSpacing}px`);
    root.style.setProperty('--zoom-level', String(zoom / 100));
  },
}));
```

**CSS変数の活用:**
```css
/* src/renderer/styles.css */

:root {
  --base-font-size: 14px;
  --font-family: system-ui, -apple-system, sans-serif;
  --line-height: 1.5;
  --letter-spacing: 0px;
  --zoom-level: 1;
}

.card {
  font-size: calc(var(--base-font-size) * var(--zoom-level));
  font-family: var(--font-family);
  line-height: var(--line-height);
  letter-spacing: var(--letter-spacing);
}
```

**マウスホイールイベント処理:**
```typescript
// App.tsx または CardPanel.tsx

useEffect(() => {
  const handleWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -10 : 10;
      const currentZoom = useFontStore.getState().zoom;
      useFontStore.getState().setZoom(currentZoom + delta);
    }
  };

  window.addEventListener('wheel', handleWheel, { passive: false });
  return () => window.removeEventListener('wheel', handleWheel);
}, []);
```

#### 5.1.3. カード選択・移動システム

**設計方針:**
- **フォーカス管理:** アクティブカードの追跡
- **複数選択:** Shift/Ctrlキーによる範囲選択・離散選択
- **キーボードナビゲーション:** 矢印キーでの移動

**実装構成:**

```typescript
// src/renderer/hooks/useCardNavigation.ts

export interface NavigationState {
  focusedCardId: string | null;
  selectedCardIds: Set<string>;
  lastSelectedId: string | null;
}

export const useCardNavigation = (
  leafId: string,
  tabId: string,
  cards: Card[]
) => {
  const [state, setState] = useState<NavigationState>({
    focusedCardId: null,
    selectedCardIds: new Set(),
    lastSelectedId: null,
  });

  const moveUp = useCallback(() => {
    // 現在のフォーカスカードの前のカードを取得
    // 階層を考慮した順序で移動
  }, [state, cards]);

  const moveDown = useCallback(() => {
    // 現在のフォーカスカードの次のカードを取得
  }, [state, cards]);

  const toggleExpand = useCallback((direction: 'left' | 'right') => {
    // 階層の展開/折りたたみ
  }, [state, cards]);

  const selectRange = useCallback((startId: string, endId: string) => {
    // startId から endId までの範囲を選択
  }, [cards]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          if (event.shiftKey) {
            selectRange(state.lastSelectedId!, state.focusedCardId!);
          } else {
            moveUp();
          }
          break;
        case 'ArrowDown':
          if (event.shiftKey) {
            selectRange(state.focusedCardId!, state.lastSelectedId!);
          } else {
            moveDown();
          }
          break;
        case 'ArrowLeft':
          toggleExpand('left');
          break;
        case 'ArrowRight':
          toggleExpand('right');
          break;
        // ...
      }
    },
    [state, moveUp, moveDown, toggleExpand, selectRange]
  );

  return { state, handleKeyDown };
};
```

#### 5.1.4. タブ切り替えシステム

**実装方法:**

```typescript
// src/renderer/store/workspaceStore.ts に追加

export interface WorkspaceStore {
  // 既存のプロパティ...

  // タブナビゲーション
  getNextTab: (leafId: string) => string | null;
  getPrevTab: (leafId: string) => string | null;
  activateNextTab: (leafId: string) => void;
  activatePrevTab: (leafId: string) => void;
}

// 実装例
getNextTab: (leafId) => {
  const state = get();
  const leaf = state.leaves[leafId];
  if (!leaf || leaf.tabs.length === 0) return null;

  const currentIndex = leaf.tabs.findIndex((tab) => tab.id === leaf.activeTabId);
  if (currentIndex === -1) return leaf.tabs[0].id;

  const nextIndex = (currentIndex + 1) % leaf.tabs.length;
  return leaf.tabs[nextIndex].id;
},

activateNextTab: (leafId) => {
  const nextTabId = get().getNextTab(leafId);
  if (nextTabId) {
    get().setActiveTab(leafId, nextTabId);
  }
},
```

**App.tsx での統合:**

```typescript
// ショートカットハンドラに追加
if (primaryPressed && key === 'tab' && !event.altKey) {
  event.preventDefault();
  if (!effectiveLeafId) {
    notify('warning', 'アクティブなパネルがありません。');
    return;
  }
  if (event.shiftKey) {
    activatePrevTab(effectiveLeafId);
  } else {
    activateNextTab(effectiveLeafId);
  }
  return;
}
```

#### 5.1.5. マトリクス画面ショートカット

**実装方法:**

```typescript
// App.tsx のショートカットハンドラに追加

if (primaryPressed && key === 'm' && !event.shiftKey && !event.altKey) {
  event.preventDefault();

  // マトリクスダイアログを開く処理
  // (既存のMatrixLaunchDialogを利用)
  setMatrixLaunchDialogOpen(true);

  pushLog({
    id: `open-matrix-${Date.now()}`,
    level: 'INFO',
    message: 'マトリクス画面を開きました (Ctrl+M)',
    timestamp: new Date(),
  });

  return;
}
```

### 5.2. 必要なライブラリと依存関係

#### 5.2.1. 新規導入が推奨されるライブラリ

| ライブラリ | 用途 | 理由 |
|-----------|------|------|
| `hotkeys-js` | ショートカットキー管理 | クロスブラウザ対応、競合検出、カスタマイズ容易 |
| `react-hotkeys-hook` | React統合 | Reactフックベースのショートカット管理 |
| `tinykeys` | 軽量キーバインド | サイズが小さく高速、TypeScript対応 |

**推奨:** `tinykeys` (1.8kB gzipped)
- 理由: 軽量、TypeScript対応、既存コードへの統合が容易

```bash
npm install tinykeys
```

#### 5.2.2. 既存ライブラリの活用

| ライブラリ | 現在の用途 | 追加活用方法 |
|-----------|----------|------------|
| `zustand` | 状態管理 | フォント設定、ショートカット設定のストア追加 |
| `tailwindcss` | スタイリング | CSS変数との組み合わせでダイナミックスタイリング |
| `react` | UIフレームワーク | カスタムフックでナビゲーション・ショートカット管理 |

#### 5.2.3. Electron特有の考慮事項

**メニューバーショートカット:**
- Electronのネイティブメニューとの統合
- `accelerator` プロパティでOSネイティブのショートカット登録

```typescript
// src/main/menu.ts (新規作成)

import { Menu, MenuItem } from 'electron';

export const createApplicationMenu = () => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'ファイル',
      submenu: [
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            // IPCでレンダラープロセスに保存指示
          }
        },
        {
          label: '別名で保存',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => { /* ... */ }
        },
        // ...
      ]
    },
    // ...
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
```

### 5.3. 設定ファイルの拡張

**settings.ts への追加:**

```typescript
// src/shared/settings.ts

export interface FontSettings {
  baseFontSize: number;
  fontFamily: string;
  lineHeight: number;
  letterSpacing: number;
  zoom: number;
}

export interface ShortcutSettings {
  keyBindings: Record<string, string>; // actionId -> keyBinding
  profile: 'default' | 'vscode' | 'emacs' | 'vim' | 'custom';
}

export interface DisplaySettings {
  cardSpacing: number;
  indentWidth: number;
  showCardIcons: boolean;
  compactModeThreshold: number; // カード数がこの値を超えたら自動でコンパクトモード
}

export interface AppSettings {
  version: number;
  theme: ThemeSettings;
  font: FontSettings;      // 新規追加
  shortcuts: ShortcutSettings; // 新規追加
  display: DisplaySettings;    // 新規追加
  input: InputSettings;
  converter: ConverterSettings;
  llm: LlmSettings;
  logging: LoggingSettings;
  workspace: WorkspaceSettings;
}

export const defaultSettings: AppSettings = {
  // ...既存設定
  font: {
    baseFontSize: 14,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    lineHeight: 1.5,
    letterSpacing: 0,
    zoom: 100,
  },
  shortcuts: {
    keyBindings: {
      'save': 'Ctrl+S',
      'saveAs': 'Ctrl+Shift+S',
      'copy': 'Ctrl+C',
      'paste': 'Ctrl+V',
      'undo': 'Ctrl+Z',
      'redo': 'Ctrl+Y',
      'search': 'Ctrl+F',
      'closeTab': 'Ctrl+W',
      'selectAll': 'Ctrl+A',
      'nextTab': 'Ctrl+Tab',
      'prevTab': 'Ctrl+Shift+Tab',
      'openMatrix': 'Ctrl+M',
      'moveUp': 'ArrowUp',
      'moveDown': 'ArrowDown',
      'expandCollapse': 'ArrowRight|ArrowLeft',
      // ...
    },
    profile: 'default',
  },
  display: {
    cardSpacing: 8,
    indentWidth: 24,
    showCardIcons: true,
    compactModeThreshold: 1000,
  },
};
```

---

## 6. タスク分割と実現順序

### 6.1. フェーズ別実装計画

#### フェーズ1: 基本ショートカットキーの実装 (優先度: 高)

**目標:** 既存提案のショートカットキーを実装

**タスク:**

1. **P1-1: ショートカットマネージャーの基盤構築**
   - タスク概要: `tinykeys` の導入とラッパー作成
   - 成果物: `src/renderer/utils/shortcutManager.ts`
   - 工数見積: 2日
   - 依存関係: なし

2. **P1-2: カード選択・移動ショートカット**
   - タスク概要:
     - `Ctrl+A`: 全カード選択
     - `↑`/`↓`: カード移動
     - `Shift+↑`/`Shift+↓`: 連続選択
     - `→`/`←`: 階層展開/折りたたみ
   - 成果物: `useCardNavigation.ts`, CardPanel.tsx更新
   - 工数見積: 3日
   - 依存関係: P1-1

3. **P1-3: タブ操作ショートカット**
   - タスク概要:
     - `Ctrl+W`: タブを閉じる
     - `Ctrl+Tab`: 次のタブ
     - `Ctrl+Shift+Tab`: 前のタブ
   - 成果物: workspaceStore.ts更新, App.tsx更新
   - 工数見積: 1日
   - 依存関係: P1-1

4. **P1-4: マトリクス画面ショートカット**
   - タスク概要: `Ctrl+M` でマトリクス画面を開く
   - 成果物: App.tsx更新
   - 工数見積: 0.5日
   - 依存関係: P1-1

5. **P1-5: ショートカット動作テスト**
   - タスク概要: E2Eテスト、ユニットテスト作成
   - 成果物: `__tests__/shortcuts.test.ts`
   - 工数見積: 2日
   - 依存関係: P1-2, P1-3, P1-4

**フェーズ1 合計工数:** 8.5日

#### フェーズ2: フォント・ズーム機能の実装 (優先度: 高)

**目標:** フォントカスタマイズとズーム機能の実装

**タスク:**

1. **P2-1: フォント設定ストアの作成**
   - タスク概要: `useFontStore` (Zustand) の実装
   - 成果物: `src/renderer/store/fontStore.ts`
   - 工数見積: 1日
   - 依存関係: なし

2. **P2-2: CSS変数システムの構築**
   - タスク概要: `:root` レベルのCSS変数定義とJavaScript連携
   - 成果物: `styles.css`, `fontStore.ts`の`applyToDOM`関数
   - 工数見積: 1日
   - 依存関係: P2-1

3. **P2-3: マウスホイールズーム実装**
   - タスク概要: `Ctrl+ホイール` でのズーム制御
   - 成果物: App.tsx または CardPanel.tsx への イベントリスナー追加
   - 工数見積: 1日
   - 依存関係: P2-2

4. **P2-4: フォント設定UIの作成**
   - タスク概要: SettingsModal に「フォント」セクションを追加
   - 成果物: SettingsModal.tsx更新, FontSettingsPanel.tsx (新規)
   - 工数見積: 2日
   - 依存関係: P2-1

5. **P2-5: ズームリセット・キーボードショートカット**
   - タスク概要:
     - `Ctrl+0`: ズームリセット
     - `Ctrl++`: ズームイン
     - `Ctrl+-`: ズームアウト
   - 成果物: App.tsx更新
   - 工数見積: 0.5日
   - 依存関係: P2-3, P1-1

6. **P2-6: フォント設定の永続化**
   - タスク概要: settings.jsonへの保存・読み込み
   - 成果物: settings.ts更新, workspace.ts更新
   - 工数見積: 1日
   - 依存関係: P2-1, P2-4

7. **P2-7: テスト作成**
   - タスク概要: フォント変更、ズーム操作のテスト
   - 成果物: `fontStore.test.ts`, E2Eテスト
   - 工数見積: 1.5日
   - 依存関係: P2-6

**フェーズ2 合計工数:** 8日

#### フェーズ3: ショートカットカスタマイズUI (優先度: 中)

**目標:** ユーザーがショートカットを自由にカスタマイズできる機能

**タスク:**

1. **P3-1: ショートカット設定ストアの作成**
   - タスク概要: `useShortcutConfigStore` (Zustand) の実装
   - 成果物: `src/renderer/store/shortcutConfigStore.ts`
   - 工数見積: 1.5日
   - 依存関係: P1-1

5. **P3-5: ショートカット設定の永続化**
   - タスク概要: settings.jsonへの保存・読み込み
   - 成果物: settings.ts更新, workspace.ts更新
   - 工数見積: 1日
   - 依存関係: P3-1

6. **P3-6: テスト作成**
   - タスク概要: 競合検出、プロファイル切替のテスト
   - 成果物: `shortcutConfigStore.test.ts`
   - 工数見積: 1.5日
   - 依存関係: P3-5

**フェーズ3 合計工数:** 10日

#### フェーズ4: 追加ナビゲーション・アクセシビリティ (優先度: 中)

**目標:** より高度なキーボードナビゲーションとアクセシビリティ対応

**タスク:**

1. **P4-1: 拡張ナビゲーション実装**
   - タスク概要:
     - `Ctrl+Home`/`Ctrl+End`: ドキュメント先頭/末尾
     - `Home`/`End`: 同階層の先頭/末尾
     - `Alt+→`/`Alt+←`: トレース先へジャンプ
   - 成果物: useCardNavigation.ts更新
   - 工数見積: 2日
   - 依存関係: P1-2

2. **P4-2: トレーサビリティナビゲーション**
   - タスク概要:
     - `Alt+↑`/`Alt+↓`: トレースグループ内移動
     - `Ctrl+Alt+T`: トレースハイライト
   - 成果物: CardPanel.tsx更新, TraceConnectorLayer.tsx更新
   - 工数見積: 2日
   - 依存関係: P4-1

3. **P4-3: クイック検索**
   - タスク概要: `/` キーでのカードパネル内検索
   - 成果物: CardPanel.tsx更新, QuickSearch.tsx (新規)
   - 工数見積: 2日
   - 依存関係: なし

5. **P4-5: フォーカスインジケータの強化**
   - タスク概要: キーボードフォーカスの視覚的明確化
   - 成果物: styles.css更新
   - 工数見積: 1日
   - 依存関係: なし

6. **P4-6: テスト作成**
   - タスク概要: ナビゲーション、アクセシビリティのテスト
   - 成果物: E2Eテスト追加
   - 工数見積: 2日
   - 依存関係: P4-1, P4-2, P4-3, P4-5

**フェーズ4 合計工数:** 11日

---

## 10. 付録

### 10.1. ショートカットキー一覧表

#### グローバルショートカット

| カテゴリ | ショートカット | 機能 | 実装状況 |
|---------|--------------|------|---------|
| **ファイル** | `Ctrl+O` | ファイルを開く | ○ (既存) |
| | `Ctrl+S` | 保存 | ○ (既存) |
| | `Ctrl+Shift+S` | 別名で保存 | ○ (既存) |
| | `Ctrl+W` | タブを閉じる | × (提案) |
| **編集** | `Ctrl+Z` | Undo | ○ (既存) |
| | `Ctrl+Y` / `Ctrl+Shift+Z` | Redo | ○ (既存) |
| | `Ctrl+C` | コピー | ○ (既存) |
| | `Ctrl+V` | ペースト | ○ (既存) |
| | `Ctrl+A` | 全選択 | × (提案) |
| | `Delete` | 削除 | ○ (既存) |
| **表示** | `Ctrl+F` | 検索 | ○ (既存) |
| | `Ctrl+B` | サイドバー切替 | ○ (既存) |
| | `Ctrl+L` | ログ切替 | ○ (既存) |
| | `Ctrl+0` | ズームリセット | × (提案) |
| | `Ctrl++` | ズームイン | × (提案) |
| | `Ctrl+-` | ズームアウト | × (提案) |
| | `Ctrl+マウスホイール` | ズーム | × (提案) |
| **パネル** | `Ctrl+\` | 左右分割 | ○ (既存) |
| | `Ctrl+Shift+\` | 上下分割 | ○ (既存) |
| **タブ** | `Ctrl+Tab` | 次のタブ | × (提案) |
| | `Ctrl+Shift+Tab` | 前のタブ | × (提案) |
| **画面** | `Ctrl+M` | マトリクス画面 | × (提案) |
| | `Ctrl+,` | 設定 | ○ (既存) |

#### カードパネルショートカット

| カテゴリ | ショートカット | 機能 | 実装状況 |
|---------|--------------|------|---------|
| **ナビゲーション** | `↑` / `↓` | カード移動 | × (提案) |
| | `→` / `←` | 展開/折りたたみ | △ (マウスのみ) |
| | `Shift+↑` / `Shift+↓` | 連続選択 | × (提案) |
| | `Home` / `End` | 同階層の先頭/末尾 | × (拡張提案) |
| | `Ctrl+Home` / `Ctrl+End` | ドキュメント先頭/末尾 | × (拡張提案) |
| **カード操作** | `Insert` | カード追加 | ○ (既存) |
| | `Ctrl+Alt+↑` | 前にカード追加 | ○ (既存) |
| | `Ctrl+Alt+↓` | 後にカード追加 | ○ (既存) |
| | `Ctrl+Alt+→` | 子としてカード追加 | ○ (既存) |
| **トレーサビリティ** | `Alt+→` / `Alt+←` | トレース先へジャンプ | × (拡張提案) |
| | `Alt+↑` / `Alt+↓` | トレースグループ内移動 | × (拡張提案) |
| | `Ctrl+Alt+T` | トレースハイライト | × (拡張提案) |
| **検索** | `/` | クイック検索 | × (拡張提案) |
| | `F3` / `Shift+F3` | 検索結果移動 | × (拡張提案) |

#### 編集モードショートカット

| ショートカット | 機能 | 実装状況 |
|--------------|------|---------|
| `Escape` | 編集キャンセル | ○ (既存) |
| `Ctrl+Enter` | 編集を保存 | ○ (既存) |

### 10.2. 参考資料

1. **公式ドキュメント:**
   - React公式: https://react.dev/
   - Electron公式: https://www.electronjs.org/
   - Zustand公式: https://github.com/pmndrs/zustand
   - Tailwind CSS公式: https://tailwindcss.com/

2. **ショートカットキーライブラリ:**
   - tinykeys: https://github.com/jamiebuilds/tinykeys
   - react-hotkeys-hook: https://github.com/JohannesKlauss/react-hotkeys-hook
   - hotkeys-js: https://github.com/jaywcjlove/hotkeys

3. **デザインリファレンス:**
   - VSCode Keyboard Shortcuts: https://code.visualstudio.com/docs/getstarted/keybindings
   - GitHub Desktop Shortcuts: https://docs.github.com/en/desktop/installing-and-configuring-github-desktop/overview/keyboard-shortcuts
   - Notion Shortcuts: https://www.notion.so/help/keyboard-shortcuts

4. **アクセシビリティガイドライン:**
   - WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
   - ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/

### 10.3. 用語集

| 用語 | 定義 |
|------|------|
| **カード** | 文書を分割した最小単位の情報ブロック |
| **トレーサビリティ** | カード間の関係性（トレース、詳細化、テストなど） |
| **グローバルショートカット** | アプリケーション全体で有効なショートカット |
| **コンテキスト依存ショートカット** | 特定の状態・画面でのみ有効なショートカット |
| **Zustand** | React向けの軽量状態管理ライブラリ |
| **CSS変数** | CSSカスタムプロパティ、動的スタイリングに利用 |
| **仮想スクロール** | 表示領域のみをレンダリングするパフォーマンス最適化技術 |

---

**レポート終了**
