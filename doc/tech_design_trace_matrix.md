# トレースマトリクス編集機能 技術検討資料

**作成日**: 2025-11-15
**バージョン**: 1.0
**対象機能**: フェーズ3.1 トレースのマトリクス編集
**参照**: `doc/implementation_plan_future_features.md` (370行目～)

---

## 目次

1. [概要](#概要)
2. [要件の整理](#要件の整理)
3. [技術選定](#技術選定)
4. [アーキテクチャ設計](#アーキテクチャ設計)
5. [マルチウィンドウ間IPC通信設計](#マルチウィンドウ間ipc通信設計)
6. [データフロー設計](#データフロー設計)
7. [タスク分割と実行順序](#タスク分割と実行順序)
8. [実装詳細](#実装詳細)
9. [リスクと対策](#リスクと対策)
10. [テスト戦略](#テスト戦略)

---

## 概要

### 目的

トレーサビリティリンクを2Dマトリクス形式で可視化・編集できる機能を提供する。
複数のマトリクスウィンドウを同時に開き、カード一覧表示との双方向リアルタイム連動を実現する。

### スコープ

- **対象**: 2つのカードファイル間のトレーサビリティリンク
- **UI形式**: モーダレスウィンドウ（複数同時起動可能）
- **操作**: マトリクス上でのトレース作成・削除・種別変更、フィルタ、エクスポート
- **連動**: カード一覧表示との選択状態・トレース状態のリアルタイム同期

### 制約条件

- Electron アプリケーション（メイン/レンダラープロセス分離）
- 既存の Zustand ベースの状態管理と共存
- パフォーマンス: 大規模データ（100行×100列以上）への対応
- ライトモード・ダークモード対応

---

## 要件の整理

### 機能要件

#### 1. マトリクス表示

- **行**: 左ファイルのカード（cardId, タイトル, ステータス）
- **列**: 右ファイルのカード（cardId, タイトル, ステータス）
- **セル**: トレースリンクの有無と種別を表示
- **ヘッダ**: 常に表示（固定）、セルは水平・垂直スクロール可能
- **レイアウト**: コンパクトな行幅・列幅で全体を俯瞰可能

#### 2. セル操作

- **クリック**: トレース作成/削除のトグル
- **右クリック**: トレース種別選択メニュー（refines, tests, satisfy, etc.）
- **ホバー**: カードプレビュー表示

#### 3. カード一覧との連動

**マトリクス → カード一覧**:
- セルクリック/右クリック操作が、カード一覧のコネクタ描画・カウントにリアルタイム反映

**カード一覧 → マトリクス**:
- カード一覧での選択カード変更時、対応する行・列をハイライト
- カード一覧でのコネクタ作成・削除・変更を、マトリクスセルに反映

#### 4. フィルタ機能

- カードID、タイトル、ステータスによるフィルタ
- 特定の列にトレースがある行のみ表示、特定の行にトレースがある列のみ表示
- AND/OR条件の組み合わせ
- 全列・全行のフィルタ解除

#### 5. ハイライト機能

- 選択カードの行・列をハイライト
- トレースあるセルをハイライト

#### 6. 統計情報

- トレース総数、未トレースカード数

#### 7. エクスポート

- CSV、Excel形式でマトリクスエクスポート

#### 8. モーダレスウィンドウ

- 複数のマトリクスウィンドウを同時に開ける
- 各ウィンドウは独立したファイルペアを表示

### 非機能要件

#### パフォーマンス

- 大規模データ（100×100以上のマトリクス）でもスムーズな操作
- 仮想スクロール導入によるDOMノード削減
- セルレンダリングの最適化

#### UI/UX

- ライトモード・ダークモード対応
- レスポンシブなレイアウト（ウィンドウリサイズ対応）
- キーボードショートカット対応

#### 保守性

- 既存コードベースとの整合性
- モジュール分割による疎結合
- TDD（テスト駆動開発）

---

## 技術選定

### グリッドライブラリの選定

大規模データの効率的な表示・操作のため、既存のグリッドライブラリを検討。

#### 候補ライブラリ比較

| ライブラリ | 特徴 | メリット | デメリット | 評価 |
|-----------|------|----------|----------|------|
| **TanStack Table v8** | ヘッドレステーブルライブラリ。React用のフック提供。仮想スクロール対応。 | ・軽量・柔軟<br>・TypeScript完全対応<br>・React 18対応<br>・MIT License | ・UIは自前実装<br>・学習コスト | ⭐⭐⭐⭐⭐ |
| **AG Grid Community** | 高機能データグリッド。仮想スクロール、フィルタ、ソート標準装備。 | ・機能豊富<br>・パフォーマンス優秀<br>・実績多数 | ・バンドルサイズ大<br>・カスタマイズ複雑<br>・Proは有料 | ⭐⭐⭐ |
| **react-window** | 仮想スクロール専門ライブラリ。シンプル。 | ・超軽量<br>・パフォーマンス最高<br>・MIT License | ・グリッド機能は自前実装<br>・行列固定ヘッダ非対応 | ⭐⭐⭐⭐ |
| **react-virtualized** | 仮想スクロール老舗ライブラリ。Grid/Table対応。 | ・実績多数<br>・機能豊富 | ・メンテナンス低下<br>・react-windowが後継 | ⭐⭐ |
| **自前実装** | HTML table + CSS Grid + IntersectionObserver | ・完全制御<br>・軽量 | ・開発コスト大<br>・バグリスク | ⭐⭐ |

#### 推奨: TanStack Table v8 + react-window の組み合わせ

**理由**:
- **TanStack Table**: テーブルロジック（ソート、フィルタ、セル管理）を提供、UIは自由に実装可能
- **react-window**: 仮想スクロールによる高速レンダリング
- **軽量**: 既存プロジェクトへの影響が小さい
- **TypeScript対応**: 型安全性
- **柔軟性**: カスタムセルレンダラ、カスタムスタイル可能

**代替案**: react-window のみで自前実装（TanStack Tableの機能が不要な場合）

### Electronマルチウィンドウ設計

#### モーダレスウィンドウの実装方針

**方式**: Electron の `BrowserWindow` を複数生成

**実装パターン**:
1. **メインウィンドウ**: 既存のカード一覧表示
2. **マトリクスウィンドウ**: ユーザー操作により動的に生成（複数可）

**ウィンドウ管理**:
- メインプロセスでウィンドウIDとファイルペアの対応を管理
- 各ウィンドウは独立したレンダラープロセス
- ウィンドウ間通信は IPC (Inter-Process Communication) 経由

#### IPC通信パターン

**Electronの標準IPC**:
- `ipcMain.handle()`: メインプロセスでリクエストを処理
- `ipcRenderer.invoke()`: レンダラーからメインへリクエスト
- `webContents.send()`: メインからレンダラーへ通知

**ウィンドウ間のリアルタイム連動**:
- **Pub/Sub パターン**: メインプロセスがイベントハブとして機能
- レンダラーA (カード一覧) → メインプロセス → レンダラーB (マトリクス)
- レンダラーB (マトリクス) → メインプロセス → レンダラーA (カード一覧)

**イベント設計**:
```typescript
// トレース変更イベント
interface TraceChangeEvent {
  leftFile: string;
  rightFile: string;
  relations: TraceabilityRelation[];
}

// カード選択変更イベント
interface CardSelectionChangeEvent {
  fileName: string;
  selectedCardIds: string[];
}
```

### 状態管理

#### Zustand ストアの拡張

既存の `traceStore.ts`, `workspaceStore.ts` を活用しつつ、マトリクス専用ストアを追加。

**新規ストア**: `matrixStore.ts`

```typescript
interface MatrixWindowState {
  windowId: string; // Electron windowId
  leftFile: string;
  rightFile: string;
  leftCards: Card[];
  rightCards: Card[];
  relations: TraceabilityRelation[];
  filters: MatrixFilter;
  highlightedCardIds: Set<string>;
}

interface MatrixStore {
  windows: Record<string, MatrixWindowState>;
  openMatrix: (leftFile: string, rightFile: string) => Promise<string>; // windowId
  closeMatrix: (windowId: string) => void;
  updateRelations: (windowId: string, relations: TraceabilityRelation[]) => void;
  setHighlight: (windowId: string, cardIds: Set<string>) => void;
  // ...
}
```

**メインプロセス側の管理**:
```typescript
// main/matrixWindowManager.ts
class MatrixWindowManager {
  private windows: Map<string, BrowserWindow> = new Map();

  createMatrixWindow(leftFile: string, rightFile: string): string {
    const windowId = nanoid();
    const window = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        preload: resolvePreloadPath(),
        contextIsolation: true,
      },
    });
    window.loadFile(resolveMatrixRendererPath());
    window.webContents.send('matrix:init', { windowId, leftFile, rightFile });
    this.windows.set(windowId, window);
    return windowId;
  }

  closeMatrixWindow(windowId: string): void {
    const window = this.windows.get(windowId);
    window?.close();
    this.windows.delete(windowId);
  }

  broadcastTraceChange(event: TraceChangeEvent): void {
    this.windows.forEach((window) => {
      window.webContents.send('trace:changed', event);
    });
  }
}
```

---

## アーキテクチャ設計

### システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│ メインプロセス (Electron Main Process)                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ MatrixWindowManager                                 │  │
│  │ - ウィンドウ生成・管理                                │  │
│  │ - IPC イベントハブ                                   │  │
│  └─────────────────────────────────────────────────────┘  │
│         ▲                 ▲                 ▲              │
│         │ IPC             │ IPC             │ IPC          │
│         │                 │                 │              │
└─────────┼─────────────────┼─────────────────┼──────────────┘
          │                 │                 │
┌─────────▼─────────┐ ┌─────▼─────────┐ ┌───▼──────────────┐
│ レンダラープロセス │ │ レンダラー     │ │ レンダラー        │
│ (メインウィンドウ) │ │ (マトリクス#1) │ │ (マトリクス#2)    │
│                   │ │               │ │                  │
│ ┌───────────────┐ │ │ ┌───────────┐ │ │ ┌──────────────┐ │
│ │ CardPanel     │ │ │ │ TraceMatrix│ │ │ │TraceMatrix   │ │
│ │ (カード一覧)   │ │ │ │Dialog     │ │ │ │Dialog        │ │
│ └───────────────┘ │ │ └───────────┘ │ │ └──────────────┘ │
│                   │ │               │ │                  │
│ ┌───────────────┐ │ │ ┌───────────┐ │ │ ┌──────────────┐ │
│ │ workspaceStore│ │ │ │matrixStore│ │ │ │matrixStore   │ │
│ │ traceStore    │ │ │ │traceStore │ │ │ │traceStore    │ │
│ └───────────────┘ │ │ └───────────┘ │ │ └──────────────┘ │
└───────────────────┘ └───────────────┘ └──────────────────┘
```

### コンポーネント構成

```
src/
├── main/
│   ├── main.ts (既存: IPC追加)
│   ├── matrixWindowManager.ts (新規)
│   └── workspace.ts (既存)
├── renderer/
│   ├── components/
│   │   ├── TraceMatrixDialog.tsx (新規: メインコンポーネント)
│   │   ├── TraceMatrixCell.tsx (新規: セルコンポーネント)
│   │   ├── TraceMatrixHeader.tsx (新規: ヘッダー)
│   │   ├── TraceMatrixToolbar.tsx (新規: ツールバー)
│   │   ├── TraceMatrixFilterPanel.tsx (新規: フィルタパネル)
│   │   └── CardPanel.tsx (既存: マトリクス起動ボタン追加)
│   ├── store/
│   │   ├── matrixStore.ts (新規)
│   │   ├── traceStore.ts (既存: 拡張)
│   │   └── workspaceStore.ts (既存)
│   ├── hooks/
│   │   ├── useMatrixGrid.ts (新規: TanStack Table統合)
│   │   └── useMatrixIPC.ts (新規: IPC通信フック)
│   ├── utils/
│   │   ├── matrixExport.ts (新規: エクスポート処理)
│   │   └── matrixFilter.ts (新規: フィルタロジック)
│   └── matrix.html (新規: マトリクスウィンドウ用HTML)
├── shared/
│   ├── traceability.ts (既存)
│   └── matrixProtocol.ts (新規: IPC型定義)
```

---

## マルチウィンドウ間IPC通信設計

### イベントフロー

#### 1. マトリクスウィンドウの起動

```
[カード一覧] ユーザーがマトリクス起動ボタンをクリック
     │
     │ ipcRenderer.invoke('matrix:open', { leftFile, rightFile })
     ▼
[Main Process] matrixWindowManager.createMatrixWindow()
     │
     │ 新しいBrowserWindowを生成
     │ matrix.htmlをロード
     ▼
[Matrix Window] 初期化
     │
     │ ipcRenderer.on('matrix:init', (event, { windowId, leftFile, rightFile }))
     ▼
[Matrix Window] データ読み込み
     │
     │ ipcRenderer.invoke('workspace:loadCardFile', leftFile)
     │ ipcRenderer.invoke('workspace:loadCardFile', rightFile)
     │ ipcRenderer.invoke('workspace:loadTraceFile', { leftFile, rightFile })
     ▼
[Matrix Window] マトリクス表示
```

#### 2. マトリクスでトレース作成

```
[Matrix Window] セルクリック → トレース作成
     │
     │ matrixStore.toggleTrace(leftCardId, rightCardId)
     │ relations配列を更新
     ▼
[Matrix Window] トレース保存
     │
     │ ipcRenderer.invoke('workspace:saveTraceFile', { leftFile, rightFile, relations })
     ▼
[Main Process] トレースファイル保存
     │
     │ 保存成功
     │ 全ウィンドウに変更通知
     ▼
[Main Process] broadcastTraceChange({ leftFile, rightFile, relations })
     │
     ├─→ [カード一覧] ipcRenderer.on('trace:changed', ...)
     │        │
     │        └─→ traceStore.cache更新 → コネクタ再描画
     │
     └─→ [Matrix Window] ipcRenderer.on('trace:changed', ...)
              │
              └─→ matrixStore.relations更新 → セル再描画
```

#### 3. カード一覧でカード選択変更

```
[カード一覧] カード選択変更
     │
     │ workspaceStore.selectCard()
     ▼
[カード一覧] 選択変更イベント発火
     │
     │ ipcRenderer.send('card-selection:changed', { fileName, selectedCardIds })
     ▼
[Main Process] 全マトリクスウィンドウに通知
     │
     └─→ [Matrix Window] ipcRenderer.on('card-selection:changed', ...)
              │
              ▼
         [Matrix Window] 対応する行・列をハイライト
              │
              └─→ matrixStore.setHighlight({ fileName, cardIds })
```

### IPC API 定義

#### メインプロセス (main/main.ts)

```typescript
// マトリクスウィンドウを開く
ipcMain.handle('matrix:open', async (event, args: { leftFile: string; rightFile: string }) => {
  const windowId = matrixWindowManager.createMatrixWindow(args.leftFile, args.rightFile);
  return { windowId };
});

// マトリクスウィンドウを閉じる
ipcMain.handle('matrix:close', async (event, args: { windowId: string }) => {
  matrixWindowManager.closeMatrixWindow(args.windowId);
  return { ok: true };
});

// トレース変更の通知（他ウィンドウへブロードキャスト）
ipcMain.on('trace:broadcast-change', (event, payload: TraceChangeEvent) => {
  matrixWindowManager.broadcastTraceChange(payload);
  // メインウィンドウにも通知
  mainWindow?.webContents.send('trace:changed', payload);
});

// カード選択変更の通知
ipcMain.on('card-selection:broadcast', (event, payload: CardSelectionChangeEvent) => {
  matrixWindowManager.broadcastCardSelection(payload);
});
```

#### レンダラープロセス (renderer/preload.ts に追加)

```typescript
const matrixApi = {
  // マトリクスウィンドウを開く
  openMatrix: (leftFile: string, rightFile: string) =>
    ipcRenderer.invoke('matrix:open', { leftFile, rightFile }),

  // マトリクスウィンドウを閉じる
  closeMatrix: (windowId: string) =>
    ipcRenderer.invoke('matrix:close', { windowId }),

  // トレース変更イベントをリッスン
  onTraceChanged: (callback: (event: TraceChangeEvent) => void) => {
    const listener = (_: any, event: TraceChangeEvent) => callback(event);
    ipcRenderer.on('trace:changed', listener);
    return () => ipcRenderer.removeListener('trace:changed', listener);
  },

  // カード選択変更イベントをリッスン
  onCardSelectionChanged: (callback: (event: CardSelectionChangeEvent) => void) => {
    const listener = (_: any, event: CardSelectionChangeEvent) => callback(event);
    ipcRenderer.on('card-selection:changed', listener);
    return () => ipcRenderer.removeListener('card-selection:changed', listener);
  },

  // トレース変更をブロードキャスト
  broadcastTraceChange: (event: TraceChangeEvent) =>
    ipcRenderer.send('trace:broadcast-change', event),

  // カード選択変更をブロードキャスト
  broadcastCardSelection: (event: CardSelectionChangeEvent) =>
    ipcRenderer.send('card-selection:broadcast', event),
};

contextBridge.exposeInMainWorld('matrixApi', matrixApi);
```

---

## データフロー設計

### トレースデータの流れ

```
┌──────────────────────────────────────────────────────────────┐
│ 初期ロード                                                    │
└──────────────────────────────────────────────────────────────┘
  Matrix Window 起動
       │
       ├─→ loadCardFile(leftFile)  → leftCards[]
       ├─→ loadCardFile(rightFile) → rightCards[]
       └─→ loadTraceFile(leftFile, rightFile) → relations[]
              │
              └─→ matrixStore.initialize({ leftCards, rightCards, relations })

┌──────────────────────────────────────────────────────────────┐
│ トレース作成/削除                                             │
└──────────────────────────────────────────────────────────────┘
  セルクリック
       │
       ▼
  matrixStore.toggleTrace(leftCardId, rightCardId)
       │
       ├─→ relations配列を更新（既存relationに追加 or 削除）
       │
       ▼
  saveTraceFile({ leftFile, rightFile, relations })
       │
       ├─→ main process: workspace.saveTraceFile()
       │        │
       │        └─→ ファイル保存 (_trace/)
       │
       ▼
  broadcastTraceChange({ leftFile, rightFile, relations })
       │
       ├─→ 全ウィンドウに通知
       │
       ├─→ [カード一覧] traceStore.cache更新
       │        │
       │        └─→ TraceConnectorLayer 再描画
       │
       └─→ [Matrix Window] matrixStore.relations更新
                │
                └─→ セル再描画

┌──────────────────────────────────────────────────────────────┐
│ カード選択連動                                                │
└──────────────────────────────────────────────────────────────┘
  [カード一覧] selectCard()
       │
       ▼
  broadcastCardSelection({ fileName, selectedCardIds })
       │
       └─→ [Matrix Window] matrixStore.setHighlight({ fileName, cardIds })
                │
                └─→ 該当行・列にハイライトクラス付与
```

### フィルタデータの流れ

```
  ユーザーがフィルタ入力
       │
       ▼
  matrixStore.setFilter({ cardIdPattern, statusFilter, ... })
       │
       ▼
  useMatrixGrid フックで filteredRows/Columns 計算
       │
       ├─→ cardIdPattern マッチング
       ├─→ statusFilter 適用
       └─→ traceExistence フィルタ適用
       │
       ▼
  TanStack Table に filteredRows/Columns を渡す
       │
       └─→ 表示更新
```

---

## タスク分割と実行順序

### Phase 1: 基盤整備（2日）

#### タスク1-1: IPC通信基盤の実装
**目的**: マルチウィンドウ間通信の仕組みを構築
**成果物**:
- `src/main/matrixWindowManager.ts`
- `src/shared/matrixProtocol.ts`
- `src/main/preload.ts` へのAPI追加

**実装内容**:
- MatrixWindowManager クラス
- IPC ハンドラ (`matrix:open`, `matrix:close`, `trace:broadcast-change`, `card-selection:broadcast`)
- preload.ts への `matrixApi` 追加

**テスト**:
- ウィンドウの生成・削除が正常に動作すること
- IPC通信でイベントが正しく伝播すること

---

#### タスク1-2: matrixStore の実装
**目的**: マトリクス専用の状態管理ストアを作成
**成果物**:
- `src/renderer/store/matrixStore.ts`

**実装内容**:
```typescript
interface MatrixFilter {
  cardIdPattern: string;
  statusFilter: Set<CardStatus>;
  kindFilter: Set<CardKind>;
  traceExistence: {
    column: string | null; // 特定列にトレースがある行のみ
    row: string | null;    // 特定行にトレースがある列のみ
  };
}

interface MatrixStore {
  windowId: string | null;
  leftFile: string | null;
  rightFile: string | null;
  leftCards: Card[];
  rightCards: Card[];
  relations: TraceabilityRelation[];
  filter: MatrixFilter;
  highlightedCardIds: Set<string>;

  initialize: (payload: { windowId: string; leftFile: string; rightFile: string; leftCards: Card[]; rightCards: Card[]; relations: TraceabilityRelation[] }) => void;
  updateRelations: (relations: TraceabilityRelation[]) => void;
  toggleTrace: (leftCardId: string, rightCardId: string) => Promise<void>;
  setTraceType: (leftCardId: string, rightCardId: string, type: TraceRelationKind) => Promise<void>;
  setFilter: (filter: Partial<MatrixFilter>) => void;
  setHighlight: (payload: { fileName: string; cardIds: string[] }) => void;
  exportToCSV: () => string;
  reset: () => void;
}
```

**テスト**:
- 単体テスト: `matrixStore.test.ts`
- toggleTrace でrelations配列が正しく更新されること
- フィルタ設定が状態に反映されること

---

#### タスク1-3: useMatrixIPC フックの実装
**目的**: IPC通信を React コンポーネントで扱いやすくする
**成果物**:
- `src/renderer/hooks/useMatrixIPC.ts`

**実装内容**:
```typescript
export const useMatrixIPC = () => {
  const updateRelations = useMatrixStore((state) => state.updateRelations);
  const setHighlight = useMatrixStore((state) => state.setHighlight);

  useEffect(() => {
    // トレース変更イベントをリッスン
    const unsubscribeTrace = window.matrixApi.onTraceChanged((event) => {
      updateRelations(event.relations);
    });

    // カード選択変更イベントをリッスン
    const unsubscribeSelection = window.matrixApi.onCardSelectionChanged((event) => {
      setHighlight({ fileName: event.fileName, cardIds: event.selectedCardIds });
    });

    return () => {
      unsubscribeTrace();
      unsubscribeSelection();
    };
  }, [updateRelations, setHighlight]);
};
```

**テスト**:
- 統合テスト: IPC イベント受信時にストアが更新されること

---

### Phase 2: マトリクス表示の実装（2日）

#### タスク2-1: TanStack Table 統合
**目的**: グリッドライブラリを導入し、マトリクスのロジックを実装
**成果物**:
- `src/renderer/hooks/useMatrixGrid.ts`
- `package.json` への依存追加

**依存ライブラリ**:
```json
{
  "@tanstack/react-table": "^8.20.5",
  "react-window": "^1.8.10",
  "@types/react-window": "^1.8.8"
}
```

**実装内容**:
```typescript
export const useMatrixGrid = () => {
  const leftCards = useMatrixStore((state) => state.leftCards);
  const rightCards = useMatrixStore((state) => state.rightCards);
  const relations = useMatrixStore((state) => state.relations);
  const filter = useMatrixStore((state) => state.filter);

  // フィルタ適用
  const filteredLeftCards = useMemo(() => {
    return leftCards.filter((card) => {
      if (filter.cardIdPattern && !card.cardId?.includes(filter.cardIdPattern)) {
        return false;
      }
      if (filter.statusFilter.size > 0 && !filter.statusFilter.has(card.status)) {
        return false;
      }
      // トレース存在フィルタ
      if (filter.traceExistence.column) {
        const hasTrace = relations.some((rel) =>
          rel.left_ids.includes(card.id) && rel.right_ids.includes(filter.traceExistence.column!)
        );
        if (!hasTrace) return false;
      }
      return true;
    });
  }, [leftCards, relations, filter]);

  const filteredRightCards = useMemo(() => {
    // 同様のフィルタロジック
  }, [rightCards, relations, filter]);

  // TanStack Table のセットアップ
  const columns = useMemo(() => {
    return [
      // 行ヘッダ列
      {
        id: 'rowHeader',
        header: '左ファイル',
        cell: (info) => info.row.original.cardId || info.row.original.id,
      },
      // 各右カードの列
      ...filteredRightCards.map((rightCard) => ({
        id: rightCard.id,
        header: rightCard.cardId || rightCard.id,
        cell: (info) => {
          const leftCard = info.row.original;
          const hasTrace = relations.some((rel) =>
            rel.left_ids.includes(leftCard.id) && rel.right_ids.includes(rightCard.id)
          );
          return hasTrace ? '●' : '';
        },
      })),
    ];
  }, [filteredRightCards, relations]);

  const table = useReactTable({
    data: filteredLeftCards,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return { table, filteredLeftCards, filteredRightCards };
};
```

**テスト**:
- 単体テスト: フィルタロジックが正しく動作すること
- セル値が正しく計算されること

---

#### タスク2-2: TraceMatrixCell コンポーネント
**目的**: マトリクスセルのUI実装
**成果物**:
- `src/renderer/components/TraceMatrixCell.tsx`

**実装内容**:
```tsx
interface TraceMatrixCellProps {
  leftCardId: string;
  rightCardId: string;
  hasTrace: boolean;
  traceType?: TraceRelationKind;
  onClick: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
  isHighlighted: boolean;
}

export const TraceMatrixCell: React.FC<TraceMatrixCellProps> = ({
  leftCardId,
  rightCardId,
  hasTrace,
  traceType,
  onClick,
  onContextMenu,
  isHighlighted,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const cellClass = cn(
    'trace-matrix-cell',
    hasTrace && 'trace-matrix-cell--traced',
    isHighlighted && 'trace-matrix-cell--highlighted',
    traceType && `trace-matrix-cell--${traceType}`
  );

  return (
    <div
      className={cellClass}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={hasTrace ? `Trace: ${traceType}` : 'No trace'}
    >
      {hasTrace ? '●' : ''}
      {isHovered && <CardPreviewTooltip leftCardId={leftCardId} rightCardId={rightCardId} />}
    </div>
  );
};
```

**スタイル**: Tailwind CSS + カスタムCSS

**テスト**:
- コンポーネントテスト: クリック・右クリックイベントが発火すること
- ホバー時にツールチップが表示されること

---

#### タスク2-3: TraceMatrixDialog コンポーネント
**目的**: マトリクスダイアログのメインコンポーネント
**成果物**:
- `src/renderer/components/TraceMatrixDialog.tsx`
- `src/renderer/components/TraceMatrixHeader.tsx`
- `src/renderer/components/TraceMatrixToolbar.tsx`

**実装内容**:
```tsx
export const TraceMatrixDialog: React.FC = () => {
  const { table, filteredLeftCards, filteredRightCards } = useMatrixGrid();
  useMatrixIPC(); // IPC通信フック

  const toggleTrace = useMatrixStore((state) => state.toggleTrace);
  const setTraceType = useMatrixStore((state) => state.setTraceType);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; leftCardId: string; rightCardId: string } | null>(null);

  const handleCellClick = (leftCardId: string, rightCardId: string) => {
    toggleTrace(leftCardId, rightCardId);
  };

  const handleCellContextMenu = (event: React.MouseEvent, leftCardId: string, rightCardId: string) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, leftCardId, rightCardId });
  };

  return (
    <div className="trace-matrix-dialog">
      <TraceMatrixHeader leftFile={...} rightFile={...} />
      <TraceMatrixToolbar />
      <div className="trace-matrix-dialog__grid">
        {/* TanStack Table + react-window で仮想スクロール */}
        <FixedSizeGrid
          columnCount={table.getAllColumns().length}
          columnWidth={120}
          height={600}
          rowCount={filteredLeftCards.length}
          rowHeight={40}
          width={1000}
        >
          {({ columnIndex, rowIndex, style }) => {
            const row = table.getRowModel().rows[rowIndex];
            const cell = row.getAllCells()[columnIndex];
            return (
              <div style={style}>
                <TraceMatrixCell
                  leftCardId={...}
                  rightCardId={...}
                  hasTrace={...}
                  onClick={() => handleCellClick(...)}
                  onContextMenu={(e) => handleCellContextMenu(e, ...)}
                  isHighlighted={...}
                />
              </div>
            );
          }}
        </FixedSizeGrid>
      </div>
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          options={TRACE_RELATION_KINDS.map((kind) => ({
            label: kind,
            onClick: () => setTraceType(contextMenu.leftCardId, contextMenu.rightCardId, kind),
          }))}
        />
      )}
    </div>
  );
};
```

**テスト**:
- E2Eテスト (Playwright): マトリクス表示・セルクリック・右クリックメニュー

---

### Phase 3: フィルタ・ハイライト機能（1日）

#### タスク3-1: フィルタパネルの実装
**成果物**:
- `src/renderer/components/TraceMatrixFilterPanel.tsx`

**実装内容**:
- カードID検索入力
- ステータスフィルタ（チェックボックス）
- トレース存在フィルタ（行・列選択）
- フィルタリセットボタン

**テスト**:
- コンポーネントテスト: フィルタ変更が matrixStore に反映されること

---

#### タスク3-2: ハイライト機能の実装
**成果物**:
- `TraceMatrixCell.tsx` へのハイライトクラス追加
- CSS スタイル

**実装内容**:
- カード選択変更イベント受信時、対応する行・列にハイライトクラス付与
- トレースあるセルにもハイライトクラス付与（オプション）

**テスト**:
- 統合テスト: カード選択変更 → ハイライト表示

---

### Phase 4: エクスポート機能（0.5日）

#### タスク4-1: CSV/Excelエクスポート
**成果物**:
- `src/renderer/utils/matrixExport.ts`

**依存ライブラリ**:
```json
{
  "xlsx": "^0.18.5"
}
```

**実装内容**:
```typescript
export const exportMatrixToCSV = (
  leftCards: Card[],
  rightCards: Card[],
  relations: TraceabilityRelation[]
): string => {
  const header = ['', ...rightCards.map((card) => card.cardId || card.id)];
  const rows = leftCards.map((leftCard) => {
    const row = [leftCard.cardId || leftCard.id];
    rightCards.forEach((rightCard) => {
      const hasTrace = relations.some((rel) =>
        rel.left_ids.includes(leftCard.id) && rel.right_ids.includes(rightCard.id)
      );
      row.push(hasTrace ? '●' : '');
    });
    return row;
  });

  return [header, ...rows].map((row) => row.join(',')).join('\n');
};

export const exportMatrixToExcel = (...) => {
  // xlsxライブラリを使用してExcelファイル生成
};
```

**テスト**:
- 単体テスト: 出力されたCSV文字列が正しいこと

---

### Phase 5: 連動機能の実装（1日）

#### タスク5-1: カード一覧 → マトリクス連動
**成果物**:
- `CardPanel.tsx` へのイベント発火処理追加

**実装内容**:
```tsx
// CardPanel.tsx
const handleCardSelection = (cardId: string) => {
  selectCard(leafId, activeTabId, cardId);

  // マトリクスウィンドウに選択変更を通知
  if (activeFileName) {
    window.matrixApi.broadcastCardSelection({
      fileName: activeFileName,
      selectedCardIds: [cardId],
    });
  }
};
```

**テスト**:
- E2Eテスト: カード一覧でカード選択 → マトリクスで行・列ハイライト

---

#### タスク5-2: マトリクス → カード一覧連動
**成果物**:
- `matrixStore.ts` へのトレース変更ブロードキャスト処理追加

**実装内容**:
```typescript
toggleTrace: async (leftCardId, rightCardId) => {
  // relations配列を更新
  const updatedRelations = ...;
  set({ relations: updatedRelations });

  // トレースファイル保存
  await window.app.workspace.saveTraceFile({ leftFile, rightFile, relations: updatedRelations });

  // 全ウィンドウに変更通知
  window.matrixApi.broadcastTraceChange({
    leftFile,
    rightFile,
    relations: updatedRelations,
  });
};
```

**テスト**:
- E2Eテスト: マトリクスでセルクリック → カード一覧のコネクタ更新

---

### Phase 6: 統合テストと最適化（1日）

#### タスク6-1: パフォーマンス最適化
- 仮想スクロールの調整
- セルレンダリングの最適化（React.memo）
- 大規模データ（500×500）でのパフォーマンステスト

#### タスク6-2: UI/UX改善
- ライトモード・ダークモード対応
- キーボードショートカット追加（Esc: 閉じる、Ctrl+F: フィルタフォーカス）
- ツールチップの改善

#### タスク6-3: E2Eテスト
- Playwright による全機能のE2Eテスト
- 複数マトリクスウィンドウの同時操作テスト
- トレース変更の整合性テスト

---

## 実装詳細

### ファイル構成

```
src/
├── main/
│   ├── main.ts                          (既存: IPC追加 100行)
│   ├── matrixWindowManager.ts           (新規: 200行)
│   └── workspace.ts                     (既存)
├── renderer/
│   ├── components/
│   │   ├── TraceMatrixDialog.tsx        (新規: 400行)
│   │   ├── TraceMatrixCell.tsx          (新規: 100行)
│   │   ├── TraceMatrixHeader.tsx        (新規: 80行)
│   │   ├── TraceMatrixToolbar.tsx       (新規: 150行)
│   │   ├── TraceMatrixFilterPanel.tsx   (新規: 200行)
│   │   └── CardPanel.tsx                (既存: 50行追加)
│   ├── store/
│   │   ├── matrixStore.ts               (新規: 300行)
│   │   ├── traceStore.ts                (既存: 50行追加)
│   │   └── workspaceStore.ts            (既存)
│   ├── hooks/
│   │   ├── useMatrixGrid.ts             (新規: 200行)
│   │   └── useMatrixIPC.ts              (新規: 100行)
│   ├── utils/
│   │   ├── matrixExport.ts              (新規: 150行)
│   │   └── matrixFilter.ts              (新規: 100行)
│   ├── matrix.html                      (新規: 50行)
│   └── matrix.tsx                       (新規: エントリーポイント 50行)
├── shared/
│   ├── traceability.ts                  (既存)
│   └── matrixProtocol.ts                (新規: 80行)
```

**合計**: 新規約2,000行、既存修正約200行

---

### データ構造

#### matrixStore の状態

```typescript
interface MatrixState {
  // ウィンドウ情報
  windowId: string | null;
  leftFile: string | null;
  rightFile: string | null;

  // カードデータ
  leftCards: Card[];
  rightCards: Card[];

  // トレースデータ
  relations: TraceabilityRelation[];

  // UIステート
  filter: MatrixFilter;
  highlightedCardIds: Set<string>; // ハイライト対象カードID
  selectedCell: { leftCardId: string; rightCardId: string } | null;

  // 統計
  stats: {
    totalTraces: number;
    untracedLeftCount: number;
    untracedRightCount: number;
  };
}
```

#### MatrixFilter

```typescript
interface MatrixFilter {
  // テキスト検索
  cardIdPattern: string; // カードID部分一致
  titlePattern: string;  // タイトル部分一致

  // ステータスフィルタ
  statusFilter: Set<CardStatus>; // 許可するステータス

  // 種別フィルタ
  kindFilter: Set<CardKind>;

  // トレース存在フィルタ
  traceExistence: {
    mode: 'all' | 'column' | 'row'; // all: フィルタなし, column: 特定列にトレースがある行, row: 特定行にトレースがある列
    targetCardId: string | null; // 対象カードID
  };

  // AND/OR条件
  logicMode: 'AND' | 'OR';
}
```

---

### スタイル設計

#### CSS クラス構成

```css
/* トレースマトリクスダイアログ */
.trace-matrix-dialog {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100vh;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

/* ヘッダー */
.trace-matrix-header {
  display: flex;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

/* ツールバー */
.trace-matrix-toolbar {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background-color: var(--bg-secondary);
}

/* グリッド */
.trace-matrix-grid {
  flex: 1;
  overflow: auto;
}

/* セル */
.trace-matrix-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: background-color 0.2s;
}

.trace-matrix-cell:hover {
  background-color: var(--bg-hover);
}

.trace-matrix-cell--traced {
  background-color: var(--trace-active-bg);
  color: var(--trace-active-fg);
}

.trace-matrix-cell--highlighted {
  border: 2px solid var(--highlight-color);
}

.trace-matrix-cell--refines {
  background-color: var(--trace-refines-bg);
}

.trace-matrix-cell--tests {
  background-color: var(--trace-tests-bg);
}

/* フィルタパネル */
.trace-matrix-filter-panel {
  padding: 1rem;
  background-color: var(--bg-tertiary);
  border-left: 1px solid var(--border-color);
}
```

#### ダークモード対応

```css
:root[data-theme='light'] {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e5e5e5;
  --text-primary: #333333;
  --border-color: #cccccc;
  --trace-active-bg: #d4edda;
  --trace-active-fg: #155724;
  --trace-refines-bg: #cce5ff;
  --trace-tests-bg: #fff3cd;
  --highlight-color: #007bff;
  --bg-hover: #f0f0f0;
}

:root[data-theme='dark'] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-tertiary: #2d2d30;
  --text-primary: #cccccc;
  --border-color: #3e3e42;
  --trace-active-bg: #1e4620;
  --trace-active-fg: #a5d6a7;
  --trace-refines-bg: #1a3a52;
  --trace-tests-bg: #4a3e1a;
  --highlight-color: #0e639c;
  --bg-hover: #2a2a2a;
}
```

---

## リスクと対策

### リスク1: パフォーマンス問題（大規模データ）

**リスク内容**: 500×500以上のマトリクスで描画が遅延する

**対策**:
- **仮想スクロール**: react-window で可視範囲のみレンダリング
- **メモ化**: React.memo でセルコンポーネントを最適化
- **デバウンス**: フィルタ入力は300ms デバウンス
- **バックグラウンド計算**: Web Worker でフィルタ計算（必要に応じて）

**成功基準**: 500×500マトリクスでスクロール60fps維持

---

### リスク2: IPC通信の遅延

**リスク内容**: ウィンドウ間のイベント伝播が遅れ、UI が不整合になる

**対策**:
- **楽観的更新**: トレース変更を即座にUIに反映、保存は非同期
- **イベントスロットリング**: 短時間の連続イベントを間引く
- **エラーリトライ**: IPC失敗時は再送信

**成功基準**: イベント伝播が100ms以内

---

### リスク3: メモリリーク

**リスク内容**: 複数ウィンドウを開閉するとメモリが増加し続ける

**対策**:
- **イベントリスナーのクリーンアップ**: useEffect のクリーンアップ関数で必ずリスナー解除
- **ウィンドウクローズ時のストアリセット**: matrixStore.reset() を呼ぶ
- **定期的なガベージコレクション確認**: DevTools Memory Profiler で監視

**成功基準**: 10回のウィンドウ開閉でメモリ増加が10%以内

---

### リスク4: 既存機能への影響

**リスク内容**: traceStore やworkspaceStore への変更が既存のカード一覧表示に悪影響を与える

**対策**:
- **最小限の変更**: 既存ストアへの変更は極力避ける
- **後方互換性**: 新規APIは既存APIと共存させる
- **リグレッションテスト**: 既存E2Eテストを全て実行

**成功基準**: 既存テストが全てパス

---

## テスト戦略

### 単体テスト（Jest）

#### テスト対象

- `matrixStore.ts`: 状態管理ロジック
- `useMatrixGrid.ts`: フィルタロジック
- `matrixExport.ts`: エクスポート処理

#### テストケース例

```typescript
describe('matrixStore', () => {
  it('toggleTrace should add trace when none exists', () => {
    const store = useMatrixStore.getState();
    store.initialize({ ... });
    store.toggleTrace('left-1', 'right-1');

    const relation = store.relations.find((rel) =>
      rel.left_ids.includes('left-1') && rel.right_ids.includes('right-1')
    );
    expect(relation).toBeDefined();
  });

  it('toggleTrace should remove trace when exists', () => {
    // ...
  });

  it('setFilter should update filtered cards', () => {
    // ...
  });
});
```

**カバレッジ目標**: 80%以上

---

### 統合テスト（Jest + Testing Library）

#### テスト対象

- IPC通信フロー（モック）
- コンポーネント間の連携

#### テストケース例

```typescript
describe('TraceMatrixDialog integration', () => {
  it('should render matrix grid with correct cells', () => {
    render(<TraceMatrixDialog />);

    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(100); // 10x10マトリクス
  });

  it('should toggle trace on cell click', async () => {
    const user = userEvent.setup();
    render(<TraceMatrixDialog />);

    const cell = screen.getByTestId('cell-left-1-right-1');
    await user.click(cell);

    expect(cell).toHaveTextContent('●');
  });
});
```

---

### E2Eテスト（Playwright）

#### テストケース

1. **マトリクスウィンドウの起動・クローズ**
   - カード一覧からマトリクス起動ボタンをクリック
   - マトリクスウィンドウが表示される
   - ウィンドウを閉じる

2. **トレース作成**
   - セルをクリック
   - トレースが作成される
   - カード一覧のコネクタが更新される

3. **トレース種別変更**
   - セルを右クリック
   - コンテキストメニューから種別を選択
   - セルの色が変わる

4. **フィルタ機能**
   - カードIDでフィルタ
   - 該当行のみ表示される

5. **カード選択連動**
   - カード一覧でカードを選択
   - マトリクスで対応する行・列がハイライト

6. **エクスポート**
   - エクスポートボタンをクリック
   - CSVファイルがダウンロードされる

#### 実行環境

```bash
npm run test:e2e
```

---

## まとめ

### 開発工数見積もり

| フェーズ | 内容 | 工数 |
|---------|------|------|
| Phase 1 | 基盤整備（IPC、matrixStore） | 2日 |
| Phase 2 | マトリクス表示（TanStack Table、セル） | 2日 |
| Phase 3 | フィルタ・ハイライト | 1日 |
| Phase 4 | エクスポート | 0.5日 |
| Phase 5 | 連動機能 | 1日 |
| Phase 6 | 統合テスト・最適化 | 1日 |
| **合計** | | **7.5日** |

※ 計画書の見積もり（3-4日）は最小実装版の場合。本設計は全機能実装を想定。

---

### 技術スタック

| カテゴリ | 技術 | バージョン |
|---------|------|-----------|
| フレームワーク | Electron | ^32.3.3 |
| UI | React | ^18.2.0 |
| 状態管理 | Zustand | ^4.5.2 |
| グリッドライブラリ | TanStack Table | ^8.20.5 |
| 仮想スクロール | react-window | ^1.8.10 |
| エクスポート | xlsx | ^0.18.5 |
| スタイル | Tailwind CSS | ^3.4.13 |
| テスト | Jest, Playwright | ^29.7.0, ^1.48.2 |

---

### 成功基準

- ✅ 複数のマトリクスウィンドウを同時に開ける
- ✅ 500×500マトリクスで60fps維持
- ✅ カード一覧との双方向リアルタイム連動
- ✅ フィルタ・ハイライト・エクスポート機能が動作
- ✅ 既存テストが全てパス
- ✅ E2Eテストが全てパス

---

## 参照資料

- [実装計画書](./implementation_plan_future_features.md) (370行目～)
- [TanStack Table Documentation](https://tanstack.com/table/latest)
- [react-window Documentation](https://react-window.vercel.app/)
- [Electron IPC Tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)

---

**承認者**: __________________
**承認日**: __________________
