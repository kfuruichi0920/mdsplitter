# 検索ダイアログ再設計 (2B-1)

## 背景
- `doc/implementation_plan_future_features.md` 2B-1 で「検索機能の改善（別ダイアログ化）」が要求されている。
- 現状の検索 UI は `src/renderer/App.tsx` 側でサイドバー内に内包され、テキスト/正規表現の単一クエリのみ対応（行: 549-2583 付近）。
- 将来的なクエリ共通化（API/MCP）に備え、検索クエリを構造化し再利用できる形へ整理する。

## 目的
1. Ctrl+F で開くモーダレスな `SearchDialog` を新設し、検索をワークスペースと分離する。
2. カード ID / トレース経路 / 高度な AND/OR 条件を含む複数クエリ種別を扱えるクエリ API を定義する。
3. 検索結果リストをタブ化し、過去検索結果を切り替えられる履歴を保持する。

## スコープ
- UI: `SearchDialog`, `AdvancedSearchBuilder` コンポーネントの追加。
- 状態: 検索ダイアログ開閉と検索履歴を zustand に集約（`useSearchStore` を新設、開閉フラグは `uiStore` にプロキシ）。
- ロジック: `src/renderer/utils/search.ts` を拡張し、構造化クエリの評価・トレース探索・ID検索を実装。
- 既存のサイドバー検索 UI を廃止し、App から新ダイアログを呼び出す。

## クエリ API 設計
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
  id: string; // 履歴タブ識別子
  scope: SearchScope;
  mode: SearchMode;
  text?: string;      // text/regex/id/trace 用
  advanced?: AdvancedQuery;
  useRegex?: boolean; // text/advanced 条件の regex 評価用
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

## ロジックの流れ
1. `SearchDialog` でリクエストを構築し `executeSearch(request)` を呼ぶ。
2. `executeSearch` は scope に応じてデータセットを構築:
   - `current`: アクティブタブのみ（無ければエラー）。
   - `open`: `useWorkspaceStore.getState().tabs` 全体。
   - `input`: `window.app.workspace.listCardFiles/loadCardFile` でロード（非同期）。
3. モード別評価:
   - **text/regex**: 既存 `createSearchMatcher` を利用しタイトル+本文にマッチング。
   - **id**: `card.cardId` / `card.id` を対象に部分一致。
   - **advanced**: `conditions` を AND/OR で評価（フィールド毎に operator を適用）。`trace` が指定されていれば後段でトレース拡張。
   - **trace**: seeds（指定なしの場合は text/id に一致したカード）を `useTraceStore.getState().getRelatedCardsWithDepth` で深さ指定探索し、到達ノードを結果に含める。
4. ヒットしたカードを `SearchResult` に整形し、`searchHistory` に `SearchTab` として push。
5. `SearchDialog` から結果選択で `App` の `handleSearchResultNavigate` を呼び、タブ/カード選択・未読ファイルロードを行う。

## UI 振る舞い
- Ctrl+F → `SearchDialog` を開く（既に開いていれば前面化＆入力フォーカス）。
- 左上にモードタブ（キーワード/ID/トレース/高度検索）、右上に範囲セレクタと実行ボタン。
- 結果ペイン下部に履歴タブ（最新が先頭）。各タブは閉じるボタン付き。
- リストアイテムはキーボード上下キーで移動、Enter/Space/クリックでカードへジャンプ。
- ID検索結果はジャンプ時に `useWorkspaceStore.selectCard` を呼んでカード枠を一時ハイライト（CSS: `.card--search-hit` を追加）。

## ストア設計
- `useSearchStore` (新規):
  - `isOpen: boolean`, `open()`, `close()`, `toggle()`
  - `history: SearchSession[]`, `activeSessionId`, `appendSession`, `activateSession`, `removeSession`
  - `lastQueryDraft`（入力復元用）
- `uiStore` に `setSearchOpen` を追加し、既存ショートカット処理は `useSearchStore().open()` を呼ぶ形へ差し替え。

## 互換・影響
- 既存サイドバー検索 UI / state を撤去し、新ダイアログへ置換。
- トレース探索は `useTraceStore` に深さ指定版 `getRelatedCardsWithDepth` を追加し既存 API は後方互換で保持。
- スタイルは `src/renderer/styles.css` にダイアログ用クラスを追加し、既存 `.sidebar__search*` は未使用となるため段階的に整理（今回は互換のため残置）。

## テスト方針
- `src/renderer/components/__tests__/SearchDialog.test.tsx`
  - Ctrl+F でダイアログが開き、キーワード入力にフォーカスする。
  - テキスト検索でタイトル/本文にマッチした結果が表示される。
  - ID モードで `cardId` に部分一致する。
  - トレースモードで種カードから深さ1の関連カードが返る（モックされた `useTraceStore`）。
  - 履歴タブの切替・削除が動作する。
- `src/renderer/utils/__tests__/search.test.ts`
  - 条件評価（AND/OR、regex/equal/contains）とトレース拡張の単体テスト。

## 実装ステップ
1. `useSearchStore` 追加＆ `App.tsx` のショートカットを `SearchDialog` 連携へ置換。
2. `SearchDialog` / `AdvancedSearchBuilder` 実装。
3. `search.ts` 拡張と `traceStore` への深さ指定 API 追加。
4. 既存 UI の検索状態を削除し、新ダイアログを組み込み。

