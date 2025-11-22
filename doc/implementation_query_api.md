# 検索画面・REST API 再設計 (2B-1)

## 背景
- `doc/implementation_plan_future_features.md` 2B-1 で「検索機能の改善（別ダイアログ化）」が要求されている。
- 本タスクでは「別画面/別ウィンドウ」へ分離し、メインウィンドウと検索ウィンドウの通信を REST API で行えるようにする。将来的な外部クエリ受付（ヘッドレス検索）も見据える。

## 目的
1. Ctrl+F で **専用検索ウィンドウ** を開く（メインとは別 BrowserWindow）。
2. 検索ウィンドウ ↔ メインウィンドウ間の通信を **ローカル REST API** で実現し、将来の外部クエリ流用を容易にする。
3. カード ID / トレース経路 / 高度 AND/OR 条件を含む複数クエリ種別を REST 経由で扱えるクエリ API を定義する。
4. 検索結果リストをタブ化し、履歴を保持してメイン側にカードフォーカス要求を REST 経由で通知できるようにする。

## スコープ
- UI: `SearchWindow`（新規 BrowserWindow）とその中で動く `SearchApp`（React/Vite）を追加。メインウィンドウは検索ボタン/ショートカットで起動のみ。
- 通信: Electron メインプロセスにローカル REST サーバ（Express）を組込み、以下を提供。
  - `/api/search` … 検索実行エンドポイント（POST）。
  - `/api/search/history` … 検索履歴取得/追加（GET/POST）。
  - `/api/focus` … メインウィンドウへカードフォーカス要求を発行（POST）。
- ロジック: `src/shared/search`（新規）に検索エンジンを移し、REST サーバと検索ウィンドウの双方から利用できるよう共有化。
- 状態: 検索履歴はメインプロセス（メモリ）で管理し、必要なら `_logs/search-history.json` に永続化（将来拡張）。

## クエリ API 設計（REST）
```ts
type SearchScope = 'current' | 'open' | 'input';
type SearchMode = 'text' | 'regex' | 'id' | 'trace' | 'advanced';

type SearchField = 'title' | 'body' | 'cardId' | 'status' | 'kind';
type SearchOperator = 'contains' | 'equals' | 'regex';

type SearchCondition = {
  field: SearchField;
  operator: SearchOperator;
  value: string;
};

type TraceQuery = {
  seeds?: { fileName: string; cardId: string }[]; // 未指定なら検索語に一致するカードを種とする
  depth: number; // default 1
};

type AdvancedQuery = {
  combinator: 'AND' | 'OR'; // 条件全体の結合方法
  conditions: SearchCondition[];
  trace?: TraceQuery; // 任意。AND/OR 評価後にトレース拡張を適用
};

type SearchRequest = {
  id?: string;           // 任意。省略時はサーバ側で生成。
  scope: SearchScope;
  mode: SearchMode;
  text?: string;         // text/regex/id/trace 用
  advanced?: AdvancedQuery;
  useRegex?: boolean;    // text/advanced 条件の regex 評価用
};

type SearchResult = {
  id: string;
  source: 'open' | 'input';
  fileName: string | null;
  tabId?: string;
  leafId?: string;
  cardId: string;
  cardTitle: string;
  snippet: string;
  matchCount: number;
};
```

### REST エンドポイント
| Method | Path | Body | 説明 |
| --- | --- | --- | --- |
| POST | `/api/search` | `SearchRequest` | 検索実行。結果と生成された `requestId` を返却。 |
| GET | `/api/search/history` | - | サーバに保持している検索履歴一覧を返す。 |
| POST | `/api/search/history` | `{ request: SearchRequest, results: SearchResult[] }` | 履歴に追加する（検索ウィンドウ側で UI 操作後に登録）。 |
| POST | `/api/focus` | `{ fileName: string; cardId: string; tabId?: string }` | メインウィンドウにカードフォーカスを要求。 |

## ロジックの流れ（別ウィンドウ + REST）
1. メインウィンドウが Ctrl+F / メニュー操作で `SearchWindow` を起動（Electron BrowserWindow, サイズ 960x720）。起動時に REST サーバが未起動なら起動。
2. `SearchWindow` 内の `SearchApp` が検索フォームから `POST /api/search` を実行。
3. REST サーバは `src/shared/search/runSearch()` を実行。`scope` により以下をデータセットに含める:
   - `current/open`: メインウィンドウからの「開いているタブのスナップショット」を REST 経由で要求 (`GET /api/workspace/tabs` を将来実装予定、当面は main が保持するタブを直接返却)。
   - `input`: `_input` からカードファイルをロード（既存 `workspace.loadCardFile` をメインプロセスで使用）。
4. 検索結果 `SearchResult[]` を検索ウィンドウへ返却し、ウィンドウ側で履歴タブに追加しつつ `POST /api/search/history` で履歴サーバへ登録。
5. ユーザが結果をクリックすると `POST /api/focus` を発行。メインウィンドウ側の REST ハンドラが `BrowserWindow.webContents.send('search:focus', payload)` を emit。
6. メインウィンドウは renderer で `ipcRenderer` 経由 `handleSearchFocus` を受信し、対象タブ/カードをアクティブ化する（既存 `handleSearchResultNavigate` ロジックを流用）。

## UI 振る舞い
- Ctrl+F → 検索ウィンドウを新規または前面化（メインウィンドウは状態保持のみ）。
- 検索ウィンドウの UI は従来の SearchDialog と同等（モードタブ/スコープ/高度検索/履歴タブ/結果リスト）。
- 結果クリックで `POST /api/focus` を発行し、メインウィンドウでカードフォーカス & ハイライト (`.card--search-hit`) を適用。

## ストア設計
- 検索ウィンドウ: `useSearchStore` は従来通り履歴とドラフトを管理（レンダラー側のみ）。
- メインプロセス: `searchHistoryStore`（新規モジュール）で履歴を保持し、REST `/api/search/history` から参照。
- メインウィンドウ: 検索開閉状態の保持は不要。`ipcRenderer` で `search:focus` を受信しカード選択のみ行う。

## 互換・影響
- 既存モーダレス SearchDialog 実装は削除/停止し、メインウィンドウには検索 UI を表示しない。
- トレース探索は従来通り `getRelatedCardsWithDepth` を利用しつつ共有モジュール化。
- REST サーバはローカルのみ（`127.0.0.1`, ランダム未使用ポート e.g. 3939）。外部公開はしない。
- IPC 依存箇所は `search:focus` イベント追加のみで、既存のカード操作ロジックを再利用。

## テスト方針
- `src/main/__tests__/searchServer.test.ts`（新規）  
  - `/api/search` が SearchRequest を受け取り runSearch を呼ぶこと  
  - `/api/focus` で `BrowserWindow.webContents.send` が呼ばれること（モック）  
  - ポート競合時に自動リトライすること
- `src/renderer/search-window/__tests__/SearchApp.test.tsx`（新規）  
  - 検索実行時に REST へ POST し、レスポンスを履歴タブへ反映  
  - 結果クリックで `/api/focus` に POST される  
- 既存 `src/renderer/utils/__tests__/search.test.ts` は共有モジュール化後も継続利用。

## 実装ステップ
1. メインプロセスに Express ベースの `searchServer` を追加（ポート自動決定、/api/search, /api/focus, /api/search/history を実装）。
2. 共有検索ロジックを `src/shared/search/index.ts` に移し、REST サーバと検索ウィンドウ双方から利用。
3. 検索ウィンドウ用エントリ `src/renderer/search-window/main.tsx` を作成し、`SearchApp` コンポーネントを起動。
4. メインウィンドウ: Ctrl+F ショートカットを検索ウィンドウの起動/前面化に差し替え。`ipcRenderer` で `search:focus` を受信してカードフォーカスを実施。
5. スタイルとテストを追加（上記テスト方針）。
