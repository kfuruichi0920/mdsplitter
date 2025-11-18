# ネイティブUIエンハンスメント提案書

## 作成日
2025-11-18

## 概要
現在のmdsplitterアプリケーションは、Electron + React + Tailwind CSSで構築されていますが、よりWindowsやmacOSのネイティブアプリケーションに近いルック&フィールを実現するための実現案を提案します。

---

## 現状分析

### 現在の技術スタック
- **フレームワーク**: Electron 32.3.3
- **UIライブラリ**: React 18.2.0
- **スタイリング**: Tailwind CSS 3.4.13
- **状態管理**: Zustand 4.5.2
- **その他**: react-window (仮想スクロール)

### 現在の実装の強み
- 詳細なUI設計書に基づいた一貫性のあるデザイン
- ライト/ダークモード対応
- 複雑な分割パネルシステム
- トレーサビリティ機能の高度な可視化

### 改善の余地
1. ウィンドウフレーム・タイトルバーが標準的なElectron/Chromiumスタイル
2. コンテキストメニューがWeb的
3. スクロールバーのスタイルがOS標準ではない
4. ダイアログやモーダルの動作がWebライク
5. ドラッグ&ドロップのフィードバックが限定的

---

## 実現案：3つのアプローチ

### アプローチ1: 段階的強化（推奨）
既存のReact + Tailwind構成を維持しつつ、ネイティブ感を高める部分的改善。

**メリット**:
- 既存コードへの影響が最小
- 段階的な導入が可能
- 学習コストが低い
- 実装リスクが低い

**デメリット**:
- 完全なネイティブ感は得られない
- 一部の機能は制限される

---

### アプローチ2: UIライブラリ全面移行
Fluent UI、Ant Design、shadcn/ui等のエンタープライズ向けUIライブラリへ移行。

**メリット**:
- プロフェッショナルな見た目
- アクセシビリティが標準装備
- コンポーネントの再利用性が高い

**デメリット**:
- 既存コードの大規模な書き換えが必要
- 学習コストが高い
- カスタマイズに制限がある
- 実装期間が長い

---

### アプローチ3: ハイブリッド（ネイティブ + Web）
重要な部分のみElectronのネイティブAPIを使用し、残りはReactで実装。

**メリット**:
- 重要な部分で真のネイティブ感を実現
- パフォーマンスが向上
- OS統合が強化される

**デメリット**:
- メインプロセスとレンダラープロセスの連携が複雑化
- デバッグが困難
- クロスプラットフォーム対応が複雑

---

## 推奨実現案の詳細（アプローチ1: 段階的強化）

### フェーズ1: ウィンドウ・タイトルバーのネイティブ化

#### 1.1 カスタムタイトルバーの実装

**使用ライブラリ**: なし（Electron標準機能 + カスタムCSS）

**実装内容**:
```typescript
// src/main/main.ts での設定
const mainWindow = new BrowserWindow({
  width: 1920,
  height: 1080,
  minWidth: 1024,
  minHeight: 768,
  titleBarStyle: 'hidden', // macOS
  titleBarOverlay: {       // Windows 11
    color: '#F8FAFC',      // ライトモード
    symbolColor: '#1E293B',
    height: 28
  },
  frame: false,            // カスタムフレーム用
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js')
  }
});
```

**実装ファイル**:
- `src/main/main.ts`: BrowserWindow設定
- `src/renderer/components/CustomTitleBar.tsx`: 新規作成
- `src/renderer/components/WindowControls.tsx`: 新規作成

**主な機能**:
- ドラッグ可能領域の設定（`-webkit-app-region: drag`）
- 最小化・最大化・閉じるボタンのネイティブ動作
- macOS: トラフィックライト（赤・黄・緑）ボタンの統合
- Windows 11: スナップレイアウト対応

---

#### 1.2 ネイティブメニューバーの実装

**使用ライブラリ**: Electron標準（Menu, MenuItem）

**実装内容**:
```typescript
// src/main/menuBuilder.ts (新規作成)
import { Menu, MenuItem, app, BrowserWindow } from 'electron';

export function buildMenu(mainWindow: BrowserWindow): Menu {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'ファイル(&F)',
      submenu: [
        {
          label: 'ファイルを開く(&O)',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu:file:open');
          }
        },
        {
          label: '上書き保存(&S)',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu:file:save');
          }
        },
        // ... 以下省略
      ]
    },
    // ... 編集、表示、ヘルプメニュー
  ];

  return Menu.buildFromTemplate(template);
}
```

**メリット**:
- OS標準のメニュー動作（macOSではトップバー、WindowsではウィンドウTop）
- キーボードショートカットの自動処理
- OSのアクセシビリティ機能との統合

---

### フェーズ2: コンテキストメニューとダイアログのネイティブ化

#### 2.1 ネイティブコンテキストメニュー

**使用ライブラリ**: `electron-context-menu` (v3.6+)

**インストール**:
```bash
npm install electron-context-menu
```

**実装内容**:
```typescript
// src/main/main.ts
import contextMenu from 'electron-context-menu';

contextMenu({
  showCopyImage: true,
  showSaveImageAs: true,
  showInspectElement: isDev,
  labels: {
    copy: 'コピー(&C)',
    paste: 'ペースト(&P)',
    cut: '切り取り(&T)',
    // ... 日本語ラベル
  }
});
```

**カスタムコンテキストメニュー**:
```typescript
// src/renderer/components/CardPanel.tsx への追加
const showCardContextMenu = (card: Card) => {
  window.electron.ipcRenderer.invoke('show-context-menu', {
    items: [
      { label: '前にカードを追加', id: 'insert-before', data: card.id },
      { label: '後にカードを追加', id: 'insert-after', data: card.id },
      { label: '子カードを追加', id: 'insert-child', data: card.id },
      { type: 'separator' },
      { label: 'コピー', id: 'copy', accelerator: 'CmdOrCtrl+C' },
      { label: 'ペースト', id: 'paste', accelerator: 'CmdOrCtrl+V' },
      { type: 'separator' },
      { label: '削除', id: 'delete', accelerator: 'Delete' },
    ]
  });
};

// IPC受信側（src/main/main.ts）
ipcMain.handle('show-context-menu', async (event, { items }) => {
  const menu = Menu.buildFromTemplate(items.map(item => ({
    ...item,
    click: () => {
      event.sender.send('context-menu-command', item.id, item.data);
    }
  })));
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender)! });
});
```

---

#### 2.2 ネイティブダイアログ

**使用ライブラリ**: Electron標準（dialog）

**実装内容**:
```typescript
// src/main/dialogManager.ts (新規作成)
import { dialog, BrowserWindow } from 'electron';

export async function showOpenDialog(
  parentWindow: BrowserWindow
): Promise<string[] | undefined> {
  const result = await dialog.showOpenDialog(parentWindow, {
    title: 'ファイルを開く',
    filters: [
      { name: 'テキストファイル', extensions: ['txt', 'md'] },
      { name: 'すべてのファイル', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections']
  });

  if (result.canceled) return undefined;
  return result.filePaths;
}

export async function showSaveDialog(
  parentWindow: BrowserWindow,
  defaultPath?: string
): Promise<string | undefined> {
  const result = await dialog.showSaveDialog(parentWindow, {
    title: 'ファイルを保存',
    defaultPath,
    filters: [
      { name: 'テキストファイル', extensions: ['txt'] },
      { name: 'Markdown', extensions: ['md'] }
    ]
  });

  if (result.canceled) return undefined;
  return result.filePath;
}

export async function showMessageBox(
  parentWindow: BrowserWindow,
  options: {
    type: 'info' | 'warning' | 'error' | 'question';
    title: string;
    message: string;
    detail?: string;
    buttons?: string[];
  }
): Promise<number> {
  const result = await dialog.showMessageBox(parentWindow, {
    type: options.type,
    title: options.title,
    message: options.message,
    detail: options.detail,
    buttons: options.buttons || ['OK'],
    defaultId: 0,
    cancelId: 1
  });

  return result.response;
}
```

**使用例**:
```typescript
// src/renderer/App.tsx での使用
const handleFileOpen = async () => {
  const files = await window.electron.ipcRenderer.invoke('dialog:open-file');
  if (files && files.length > 0) {
    // ファイル読み込み処理
  }
};

const handleSave = async () => {
  const response = await window.electron.ipcRenderer.invoke(
    'dialog:message-box',
    {
      type: 'question',
      title: '確認',
      message: '保存されていない変更があります。保存しますか？',
      buttons: ['保存する', 'キャンセル', '保存しない']
    }
  );

  if (response === 0) {
    // 保存処理
  }
};
```

---

### フェーズ3: スクロールバーとネイティブ感の向上

#### 3.1 OSネイティブスクロールバー

**実装方法**: CSS Overlayscrollbars + OS標準スタイル

**使用ライブラリ**: `overlayscrollbars` (v2.4+) または CSS のみ

**CSS実装**:
```css
/* src/renderer/styles/native-scrollbar.css (新規作成) */

/* Webkit（macOS, Windows Chrome）用 */
::-webkit-scrollbar {
  width: 14px;
  height: 14px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 7px;
  border: 3px solid transparent;
  background-clip: content-box;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.35);
  background-clip: content-box;
}

/* ダークモード */
html.dark ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  background-clip: content-box;
}

html.dark ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.35);
  background-clip: content-box;
}

/* Firefox用 */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

html.dark * {
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

/* macOS風オーバーレイスクロール */
.native-scroll-overlay {
  overflow: overlay; /* Chromium legacy */
  overflow: auto;
}

.native-scroll-overlay::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.native-scroll-overlay::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 5px;
}

.native-scroll-overlay:hover::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.5);
}
```

**適用**:
```tsx
// src/renderer/components/CardPanel.tsx
<div className="card-list native-scroll-overlay overflow-y-auto">
  {/* カードリスト */}
</div>
```

---

#### 3.2 ドラッグ&ドロップの改善

**使用ライブラリ**: `@dnd-kit/core` + `@dnd-kit/sortable` (v8.0+)

既存の実装よりもネイティブに近いフィードバックを提供。

**インストール**:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

**実装例**:
```tsx
// src/renderer/components/CardList.tsx (改善版)
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

export function CardList({ cards }: { cards: Card[] }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8pxドラッグで開始（誤操作防止）
      },
    })
  );

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={cards} strategy={verticalListSortingStrategy}>
        {cards.map(card => (
          <SortableCard key={card.id} card={card} />
        ))}
      </SortableContext>
      <DragOverlay>
        {activeCard ? <CardPreview card={activeCard} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
```

---

### フェーズ4: アニメーションとフィードバックの改善

#### 4.1 ネイティブ風アニメーション

**使用ライブラリ**: `framer-motion` (v10.16+)

**インストール**:
```bash
npm install framer-motion
```

**実装例**:
```tsx
// src/renderer/components/Card.tsx への追加
import { motion, AnimatePresence } from 'framer-motion';

export function Card({ card, isSelected }: CardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 30,
        mass: 1
      }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn('card', isSelected && 'card--selected')}
    >
      {/* カード内容 */}
    </motion.div>
  );
}

// モーダルのアニメーション
export function Modal({ isOpen, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="modal-content"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

---

#### 4.2 ハプティックフィードバック（macOS）

**実装内容**:
```typescript
// src/main/haptics.ts (新規作成)
// macOSのみで動作
export function triggerHapticFeedback(type: 'selection' | 'alignment' | 'levelChange') {
  if (process.platform !== 'darwin') return;

  // Electronには直接のHaptic APIがないため、AppleScriptで実現
  const { execSync } = require('child_process');

  try {
    switch (type) {
      case 'selection':
        execSync('osascript -e "beep"');
        break;
      // 他のフィードバックタイプ
    }
  } catch (err) {
    console.warn('Haptic feedback failed:', err);
  }
}
```

---

### フェーズ5: 追加のネイティブ機能統合

#### 5.1 ウィンドウ状態の永続化

**使用ライブラリ**: `electron-window-state` (v5.0+)

**インストール**:
```bash
npm install electron-window-state
```

**実装**:
```typescript
// src/main/main.ts
import windowStateKeeper from 'electron-window-state';

function createMainWindow() {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1920,
    defaultHeight: 1080,
    file: 'window-state.json',
    path: app.getPath('userData')
  });

  const mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    // ... 他の設定
  });

  mainWindowState.manage(mainWindow);

  return mainWindow;
}
```

---

#### 5.2 システムテーマの自動追従

**実装内容**:
```typescript
// src/main/main.ts
import { nativeTheme } from 'electron';

nativeTheme.on('updated', () => {
  const shouldUseDarkColors = nativeTheme.shouldUseDarkColors;
  mainWindow.webContents.send('theme:system-changed', {
    theme: shouldUseDarkColors ? 'dark' : 'light'
  });
});

// src/renderer/App.tsx
useEffect(() => {
  const unsubscribe = window.electron.ipcRenderer.on(
    'theme:system-changed',
    (_event, { theme }) => {
      if (uiStore.themeMode === 'system') {
        setTheme(theme);
      }
    }
  );
  return unsubscribe;
}, []);
```

---

#### 5.3 通知センター統合

**実装内容**:
```typescript
// src/main/notifications.ts (新規作成)
import { Notification } from 'electron';

export function showNotification(options: {
  title: string;
  body: string;
  icon?: string;
  urgency?: 'normal' | 'critical' | 'low';
}) {
  if (!Notification.isSupported()) {
    console.warn('Notifications not supported');
    return;
  }

  const notification = new Notification({
    title: options.title,
    body: options.body,
    icon: options.icon,
    urgency: options.urgency || 'normal',
    timeoutType: 'default'
  });

  notification.show();

  notification.on('click', () => {
    // ウィンドウをフォーカス
    mainWindow.show();
    mainWindow.focus();
  });
}
```

---

#### 5.4 ファイルドラッグ&ドロップ

**実装内容**:
```tsx
// src/renderer/App.tsx への追加
useEffect(() => {
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer?.files || []);
    const textFiles = files.filter(f =>
      f.name.endsWith('.txt') || f.name.endsWith('.md')
    );

    if (textFiles.length > 0) {
      handleFilesDropped(textFiles);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  document.addEventListener('drop', handleDrop);
  document.addEventListener('dragover', handleDragOver);

  return () => {
    document.removeEventListener('drop', handleDrop);
    document.removeEventListener('dragover', handleDragOver);
  };
}, []);
```

---

#### 5.5 OS統合メニュー（macOS Dock/Windows タスクバー）

**実装内容**:
```typescript
// src/main/main.ts (macOS)
if (process.platform === 'darwin') {
  const dockMenu = Menu.buildFromTemplate([
    {
      label: '新規ウィンドウ',
      click: () => createMainWindow()
    },
    {
      label: '最近使ったファイル',
      submenu: recentFiles.map(file => ({
        label: path.basename(file),
        click: () => openFile(file)
      }))
    }
  ]);
  app.dock.setMenu(dockMenu);
}

// src/main/main.ts (Windows)
if (process.platform === 'win32') {
  mainWindow.setThumbarButtons([
    {
      tooltip: '前のカード',
      icon: path.join(__dirname, 'icons/prev.png'),
      click: () => mainWindow.webContents.send('card:previous')
    },
    {
      tooltip: '次のカード',
      icon: path.join(__dirname, 'icons/next.png'),
      click: () => mainWindow.webContents.send('card:next')
    }
  ]);
}
```

---

## UIコンポーネントライブラリの選定（オプション）

### Option A: shadcn/ui（推奨）

**特徴**:
- Radix UI + Tailwind CSSの組み合わせ
- 既存のTailwind構成と親和性が高い
- コンポーネントをコピーして使用（依存関係が少ない）
- 完全なカスタマイズが可能

**インストール**:
```bash
npx shadcn-ui@latest init
```

**導入コンポーネント例**:
- Button: `npx shadcn-ui@latest add button`
- Dialog: `npx shadcn-ui@latest add dialog`
- DropdownMenu: `npx shadcn-ui@latest add dropdown-menu`
- Tabs: `npx shadcn-ui@latest add tabs`
- Tooltip: `npx shadcn-ui@latest add tooltip`

**メリット**:
- 段階的な導入が可能
- 既存コードへの影響が最小
- TypeScript完全対応
- アクセシビリティが標準装備

---

### Option B: Fluent UI React (Microsoft)

**特徴**:
- Windows 11のネイティブデザイン
- エンタープライズ向け
- 豊富なコンポーネント

**インストール**:
```bash
npm install @fluentui/react-components
```

**メリット**:
- Windowsネイティブに最も近い
- Microsoft製品との統一感

**デメリット**:
- 学習コストが高い
- Tailwindとの併用が難しい
- 全面移行が必要

---

### Option C: Ant Design

**特徴**:
- エンタープライズ向け
- 豊富なコンポーネント
- 中国市場で人気

**インストール**:
```bash
npm install antd
```

**メリット**:
- 完成度が高い
- ドキュメントが充実

**デメリット**:
- デザインに個性が強い
- ファイルサイズが大きい
- Tailwindとの併用が難しい

---

## 実装ロードマップ

### 短期（1-2週間）
- [x] カスタムタイトルバーの実装
- [x] ネイティブメニューバーの実装
- [x] ウィンドウ状態の永続化
- [x] システムテーマ自動追従

### 中期（3-4週間）
- [ ] ネイティブコンテキストメニュー実装
- [ ] ネイティブダイアログ実装
- [ ] OSネイティブスクロールバー適用
- [ ] ファイルドラッグ&ドロップ実装

### 長期（5-8週間）
- [ ] framer-motionによるアニメーション改善
- [ ] @dnd-kit/coreによるD&D改善
- [ ] shadcn/ui段階的導入
- [ ] 通知センター統合
- [ ] OS統合メニュー実装

---

## パフォーマンス考慮事項

### 1. レンダリング最適化
- React.memoの適切な使用
- useCallbackによるコールバック安定化
- 仮想スクロール（react-window）の継続使用

### 2. メモリ管理
- 大量カード表示時のメモリ使用量監視
- 不要なDOM要素の削除
- 画像の遅延ロード

### 3. IPC通信最適化
- バッチ処理による通信回数削減
- 大きなデータのストリーミング送信
- 必要最小限のデータ転送

---

## クロスプラットフォーム対応

### macOS固有の実装
- トラフィックライトボタン
- Dockメニュー
- Touch Bar対応（将来）
- ハプティックフィードバック

### Windows固有の実装
- スナップレイアウト（Windows 11）
- タスクバーボタン
- ジャンプリスト
- Acrylic/Mica効果（将来）

### Linux固有の実装
- GTKテーマとの統合
- デスクトップ環境の検出
- システムトレイアイコン

---

## リスク管理

### 技術的リスク
1. **互換性問題**: 特定のElectronバージョンでAPIが動作しない
   - 対策: 段階的な導入とフォールバック実装

2. **パフォーマンス低下**: アニメーションが重い
   - 対策: パフォーマンス設定でアニメーション無効化オプション

3. **OS依存の不具合**: 特定OSでのみ発生する問題
   - 対策: クロスプラットフォームテストの強化

### プロジェクトリスク
1. **実装期間の延長**: 想定より時間がかかる
   - 対策: MVPの明確化と段階的リリース

2. **既存機能への影響**: 既存コードの破壊
   - 対策: 十分なユニットテスト・E2Eテストの実施

---

## 成功の測定基準

### 定量的指標
- [ ] ユーザー満足度調査で80%以上が「ネイティブアプリと同等」と回答
- [ ] アプリ起動時間: 3秒以内
- [ ] メモリ使用量: 500MB以内（10,000カード表示時）
- [ ] FPS: 60fps維持（アニメーション時）

### 定性的指標
- [ ] ウィンドウ操作がOS標準と一致
- [ ] コンテキストメニューがOS標準
- [ ] ダイアログ動作がOS標準
- [ ] スクロール体験がネイティブアプリと同等

---

## まとめ

**推奨アプローチ**: アプローチ1（段階的強化）

**推奨ライブラリ**:
1. **shadcn/ui**: 既存Tailwind構成との親和性が高く、段階的導入が可能
2. **electron-window-state**: ウィンドウ状態管理
3. **electron-context-menu**: ネイティブコンテキストメニュー
4. **framer-motion**: スムーズなアニメーション
5. **@dnd-kit/core**: ネイティブ風ドラッグ&ドロップ

**実装優先順位**:
1. カスタムタイトルバー + ネイティブメニュー（最重要）
2. ネイティブダイアログ・コンテキストメニュー（重要）
3. スクロールバー・アニメーション改善（中程度）
4. その他のOS統合機能（低〜中程度）

この提案により、既存のコードベースを最大限活用しながら、段階的にネイティブアプリの体験を実現できます。
