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

#### 4.2.2. ショートカットキーのカスタマイズ機能

**1. ショートカット設定UI**
- **提案:**
  - 設定ダイアログに「キーボード」セクションを追加
  - 各機能にショートカットを割り当て可能
  - 競合検出とバリデーション
  - デフォルトにリセット機能

**2. キーバインドプロファイル**
- **提案:**
  - VSCode風、Emacs風、Vim風などのプリセット
  - カスタムプロファイルの保存・読み込み

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

#### 4.2.4. アクセシビリティ向上

**1. スクリーンリーダー対応**
- **提案:**
  - ARIA属性の適切な設定
  - フォーカスインジケータの強化
  - カード選択時の音声フィードバック
  - ショートカット一覧の読み上げ対応

**2. コントラスト設定**
- **提案:**
  - 高コントラストモード
  - カスタムカラーパレット
  - 色覚異常対応モード

#### 4.2.5. パフォーマンス設定

**1. レンダリング最適化**
- **提案:**
  - 仮想スクロール有効化/無効化
  - 1ページあたりの表示カード数設定
  - アニメーション効果の有効化/無効化
  - Markdownプレビューの遅延読み込み

**2. 大量カード対応**
- **提案:**
  - カード数閾値の警告設定
  - 自動コンパクトモード切替
  - メモリ使用量の表示

#### 4.2.6. エクスポート・共有機能

**1. ショートカットキーマップのエクスポート**
- **提案:**
  - `Ctrl+Shift+K`: ショートカット一覧を表示
  - PDF/HTMLでのエクスポート
  - 印刷可能なチートシート生成

**2. カスタマイズ設定の共有**
- **提案:**
  - 設定のエクスポート/インポート（JSON）
  - プロファイルの共有機能
  - チーム向けの標準設定配布

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

2. **P3-2: ショートカット競合検出機能**
   - タスク概要: キーバインドの重複チェックとバリデーション
   - 成果物: `shortcutManager.ts` への検証関数追加
   - 工数見積: 1日
   - 依存関係: P3-1

3. **P3-3: ショートカット設定UIの作成**
   - タスク概要: SettingsModal に「キーボード」セクションを追加
   - 成果物: ShortcutSettingsPanel.tsx (新規)
   - 工数見積: 3日
   - 依存関係: P3-1, P3-2

4. **P3-4: プロファイル機能の実装**
   - タスク概要: VSCode風、Emacs風等のプリセット
   - 成果物: `shortcutProfiles.ts`, ShortcutSettingsPanel.tsx更新
   - 工数見積: 2日
   - 依存関係: P3-3

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

4. **P4-4: ARIA属性の強化**
   - タスク概要: スクリーンリーダー対応の改善
   - 成果物: Card.tsx, CardPanel.tsx等の更新
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
   - 依存関係: P4-1, P4-2, P4-3, P4-4, P4-5

**フェーズ4 合計工数:** 11日

#### フェーズ5: 表示カスタマイズとパフォーマンス (優先度: 低)

**目標:** 詳細な表示設定とパフォーマンス最適化

**タスク:**

1. **P5-1: 表示設定ストアの作成**
   - タスク概要: `useDisplayStore` (Zustand) の実装
   - 成果物: `src/renderer/store/displayStore.ts`
   - 工数見積: 1日
   - 依存関係: なし

2. **P5-2: カード表示オプションUI**
   - タスク概要:
     - カード間スペーシング調整
     - インデント幅調整
     - アイコンサイズ調整
   - 成果物: DisplaySettingsPanel.tsx (新規)
   - 工数見積: 2日
   - 依存関係: P5-1

3. **P5-3: 高コントラストモード**
   - タスク概要: アクセシビリティ向上のための高コントラストテーマ
   - 成果物: settings.ts更新, styles.css更新
   - 工数見積: 1.5日
   - 依存関係: なし

4. **P5-4: パフォーマンス設定UI**
   - タスク概要:
     - 仮想スクロールON/OFF
     - アニメーションON/OFF
     - 自動コンパクトモード閾値設定
   - 成果物: PerformanceSettingsPanel.tsx (新規)
   - 工数見積: 2日
   - 依存関係: P5-1

5. **P5-5: ショートカット一覧エクスポート**
   - タスク概要: `Ctrl+Shift+K` でショートカット一覧表示、PDF/HTML出力
   - 成果物: ShortcutCheatSheet.tsx (新規)
   - 工数見積: 2日
   - 依存関係: P3-1

6. **P5-6: 設定の import/export**
   - タスク概要: 設定全体のJSON形式での入出力
   - 成果物: SettingsModal.tsx更新
   - 工数見積: 1.5日
   - 依存関係: なし

7. **P5-7: テスト作成**
   - タスク概要: 表示設定、パフォーマンス設定のテスト
   - 成果物: ユニット・E2Eテスト
   - 工数見積: 2日
   - 依存関係: P5-2, P5-4, P5-5, P5-6

**フェーズ5 合計工数:** 12日

### 6.2. マイルストーン

| マイルストーン | 対象フェーズ | 完了予定 | 成果物 |
|--------------|------------|---------|--------|
| **M1: 基本操作性向上** | フェーズ1 | +2週間 | 基本ショートカットキー実装完了 |
| **M2: カスタマイズ基盤** | フェーズ2 | +4週間 | フォント・ズーム機能実装完了 |
| **M3: 高度なカスタマイズ** | フェーズ3 | +6週間 | ショートカットカスタマイズUI完成 |
| **M4: アクセシビリティ対応** | フェーズ4 | +8週間 | アクセシビリティ強化完了 |
| **M5: 完全カスタマイズ対応** | フェーズ5 | +10週間 | 全機能実装完了 |

### 6.3. リソース見積

**総工数:** 49.5日 (約10週間)

**推奨チーム構成:**
- フロントエンドエンジニア: 1名
- UI/UXデザイナー: 0.5名 (設定UI設計時のみ)
- QAエンジニア: 0.5名 (テストフェーズ)

**並行作業の可能性:**
- フェーズ1とフェーズ2は一部並行可能（P1-1完了後、P2-1開始可能）
- フェーズ4は他のフェーズと独立して実装可能

### 6.4. リスクと対策

| リスク | 影響度 | 発生確率 | 対策 |
|-------|-------|---------|------|
| **ショートカット競合** | 高 | 中 | 競合検出機能の早期実装、ユーザーテストによる検証 |
| **パフォーマンス劣化** | 中 | 中 | ベンチマーク測定、仮想スクロールの最適化 |
| **既存機能との統合困難** | 中 | 低 | 段階的な統合、十分なテスト |
| **ブラウザ依存の問題** | 低 | 低 | Electron環境のため影響小、クロスプラットフォームテスト |
| **ユーザー学習コスト** | 中 | 中 | チュートリアル作成、デフォルト設定の慎重な選定 |

---

## 7. 成功基準と評価指標

### 7.1. 機能要件の達成基準

| 機能 | 達成基準 |
|------|---------|
| **ショートカットキー** | 提案された全ショートカットが動作すること |
| **カスタマイズ** | フォント・ズーム・ショートカットの全設定が可能であること |
| **永続化** | 設定が再起動後も保持されること |
| **競合検出** | ショートカットの重複が検出され、警告されること |
| **テーマ連動** | マトリクス画面がカード画面のテーマに従うこと |

### 7.2. 非機能要件の達成基準

| 項目 | 目標値 | 測定方法 |
|------|-------|---------|
| **レスポンス時間** | ショートカット実行 < 100ms | パフォーマンス測定 |
| **設定反映時間** | フォント変更 < 200ms | UI測定 |
| **ズーム操作** | 60fps維持 | FPS測定ツール |
| **メモリ増加** | < 10MB (追加機能による) | メモリプロファイラ |
| **バンドルサイズ増加** | < 50KB | ビルド解析 |

### 7.3. ユーザビリティ評価

- **学習時間:** 新規ユーザーが基本ショートカットを習得するまで < 10分
- **効率向上:** キーボード操作のみでの作業時間が30%短縮
- **エラー率:** ショートカット誤操作 < 5% (ユーザーテストで測定)
- **満足度:** ユーザー満足度調査で80%以上の肯定的評価

---

## 8. 今後の拡張可能性

### 8.1. 短期的拡張 (6ヶ月以内)

1. **音声コマンド対応**
   - Web Speech APIを利用した音声操作
   - 「次のカードへ移動」「カードを保存」などの自然言語コマンド

2. **マクロ機能**
   - 一連のショートカット操作を記録・再生
   - カスタムマクロの作成・共有

3. **マルチディスプレイ対応**
   - 複数画面での最適なウィンドウ配置
   - ディスプレイごとのズーム設定

### 8.2. 中期的拡張 (1年以内)

1. **AI支援ショートカット提案**
   - ユーザーの操作パターンを学習
   - 効率的なショートカット組み合わせを提案

2. **コラボレーション機能との統合**
   - リアルタイム編集時のカーソル同期
   - 共同編集者のショートカット表示

3. **プラグインシステム**
   - カスタムショートカットアクションの追加
   - サードパーティプラグインのサポート

### 8.3. 長期的拡張 (2年以内)

1. **機械学習による最適化**
   - カード構造の自動認識精度向上
   - ユーザー行動に基づく UI 最適化

2. **WebAssembly活用**
   - パフォーマンスクリティカルな処理の高速化
   - 大規模データ処理の改善

3. **クロスプラットフォーム拡張**
   - Webアプリ版の提供
   - モバイルアプリ対応

---

## 9. 結論

### 9.1. 総合評価

本検討により、mdsplitterアプリケーションのカスタマイズ性と操作性を大幅に向上させる包括的な改善計画を策定しました。

**主要なポイント:**

1. **実現可能性:** 既存のReact/TypeScript基盤を活用し、段階的な実装が可能
2. **ユーザー価値:** キーボード中心の操作により作業効率が大幅に向上
3. **拡張性:** カスタマイズ機能により、個々のユーザーニーズに対応
4. **アクセシビリティ:** 多様なユーザーが利用可能な設計

### 9.2. 推奨される実装順序

**優先度1 (必須):** フェーズ1 + フェーズ2
- 基本的なショートカットキーとフォント・ズーム機能
- ユーザーからの最も強い要望に対応
- 工数: 16.5日 (約3.5週間)

**優先度2 (推奨):** フェーズ3
- ショートカットカスタマイズUI
- パワーユーザーの生産性向上
- 工数: 10日 (約2週間)

**優先度3 (オプション):** フェーズ4 + フェーズ5
- 高度な機能とアクセシビリティ対応
- 製品の完成度向上
- 工数: 23日 (約5週間)

### 9.3. 次のステップ

1. **ステークホルダーレビュー:** 本レポートを関係者と共有し、フィードバック収集
2. **優先順位の最終決定:** リソースと期限を考慮した実装範囲の確定
3. **詳細設計:** 選定されたフェーズの技術仕様書作成
4. **プロトタイプ開発:** フェーズ1の一部機能でPoCを実施
5. **本格実装開始:** 承認後、計画に沿って実装を開始

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
