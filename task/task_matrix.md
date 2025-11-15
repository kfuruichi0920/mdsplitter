# トレースマトリクス機能 実装計画

## 1. 実現性確認
- 技術検討資料では、目的・スコープ・UI制約が明確化され、Electron + React + Zustand環境でのモーダレス複数ウィンドウ構成と双方向同期が整理済みのため、既存アーキテクチャ上での実現が可能と判断した。(根拠: `doc/tech_design_trace_matrix.md:25-115`)
- 実装計画書で依存要素（cardId, deprecated status）と必要コンポーネントが列挙されており、フェーズ3.1としてリソース見積もり（3-4日）が設定されているため、スケジュール的にも成立すると評価。(根拠: `doc/implementation_plan_future_features.md:370-435`)
- 提示された画面イメージ（image.png）と技術検討資料のUI定義（ヘッダ固定、行列フィルタ、色分けセル）に乖離が無く、ライトモード配色変数も設計済みのため、UI要件の再実装は不要。(根拠: `doc/tech_design_trace_matrix.md:52-123, 1141-1244` + image.png)

## 2. 実装方針と前提
1. **インフラ準備**: Electronメインプロセスに `MatrixWindowManager` とIPCルートを追加し、preloadで `matrixApi` を公開。Zustandベースの `matrixStore` を新設して各ウィンドウ状態を管理。(根拠: `doc/tech_design_trace_matrix.md:200-404`)
2. **UIフレーム**: TanStack Table + react-window を採用した仮想グリッドでTraceMatrixDialog/Cell/Toolbar/FilterPanelを構築し、行列ヘッダ固定やセル操作フローを実現。(根拠: `doc/tech_design_trace_matrix.md:52-118, 670-920`)
3. **カード一覧連動**: 既存 `workspaceStore` / `traceStore` を拡張し、カード選択・トレース変更イベントをIPCで相互配信。ハイライト状態と統計情報を matrixStore で集計。(根拠: `doc/tech_design_trace_matrix.md:66-115, 480-620, 905-916, 1079-1132`)
4. **エクスポート/統計**: `matrixExport.ts` にCSV/Excel出力と行列フィルタ状態を反映する層を実装し、Toolbarのエクスポート操作に接続。(根拠: `doc/tech_design_trace_matrix.md:405-472, 921-999`)
5. **リスク対策**: 仮想スクロール・楽観的UI更新・イベントクリーンアップなど資料で列挙された対策を各フェーズで適用。(根拠: `doc/tech_design_trace_matrix.md:1250-1300`)

## 3. 開発フェーズ別タスク
| フェーズ | 目的 | 主タスク | 成果物/テスト |
| --- | --- | --- | --- |
| Phase 0: 事前確認 (0.5日) | 依存機能の有効化確認 | cardId/deprecated status 実装がmainブランチに含まれるか確認し、不足なら優先反映。traceStoreの現状API把握。 | チェックリスト更新、既存Jest/Playwrightのスモーク実行。
| Phase 1: IPC/ストア基盤 (1.5日) | マルチウィンドウ基盤構築 | `main/matrixWindowManager.ts`, `main/main.ts` IPC追加、`renderer/preload.ts` で `matrixApi` 公開、`renderer/store/matrixStore.ts` 作成（状態+アクション+統計計算）。 | matrixStore単体テスト (toggleTrace, setHighlight)、IPCモックテスト。(根拠: `doc/tech_design_trace_matrix.md:200-404, 1079-1132`)
| Phase 2: マトリクス表示 (2日) | 仮想グリッドUIとセル操作 | `TraceMatrixDialog/Header/Toolbar/Cell` 実装、`useMatrixGrid`/`useMatrixIPC` フック作成、react-window + TanStack Table連携、セルクリック/右クリック/ホバー(UIイメージ準拠)。 | React Testing Libraryでセル描画テスト、Playwrightでセル操作のE2E。(根拠: `doc/tech_design_trace_matrix.md:670-880` + image.png)
| Phase 3: フィルタ & ハイライト (1日) | 行列フィルタ・選択連動 | `TraceMatrixFilterPanel`、AND/ORロジック、行列トレース存在フィルタ、カード選択イベント受信とハイライト描画。Toolbarに行/列フィルタ解除ボタンを実装し、画面イメージの操作性を再現。 | matrixStoreフィルタロジック単体テスト、Playwrightでカード選択同期。(根拠: `doc/tech_design_trace_matrix.md:75-115, 888-916` + image.png)
| Phase 4: エクスポート/統計 (0.5日) | CSV/Excel出力と画面下部統計 | `matrixExport.ts`、`renderer/utils` 経由で `xlsx` 呼び出し、Toolbarのエクスポートボタン、統計表示（総トレース・未トレース左右）。 | JestでmatrixExportのフォーマット検証、E2EでCSV生成。(根拠: `doc/tech_design_trace_matrix.md:88-94, 921-999`)
| Phase 5: 連動最適化 (1日) | IPC同期とリグレッション | `traceStore`/`workspaceStore` の更新フック実装、カード一覧とのハイライト同期、エラー/楽観更新処理、リスク対策適用。 | 既存トレースE2E回帰、メモリリーク監視。(根拠: `doc/tech_design_trace_matrix.md:66-115, 480-620, 1250-1300`)
| Phase 6: 仕上げ (0.5日) | UI磨き・ドキュメント | 色定義(ライト/ダーク)のCSS調整、操作説明追加、仕様書/詳細設計更新。 | UXレビュー、ドキュメント更新。(根拠: `doc/tech_design_trace_matrix.md:1141-1244`)

## 4. 詳細タスクリスト
1. matrixStore
   - 状態スキーマ/アクション実装 (initialize, toggleTrace, setTraceType, applyFilter, setHighlight, computeStats)。
   - Jestテスト: 追加/削除/種別変更/統計計算/AND-ORフィルタ。
2. IPC/Window管理
   - `MatrixWindowManager` でBrowserWindow生成/閉鎖、broadcast API、メモリリーク対策（close hookでcleanup）。
   - preload: `matrixApi` expose + 型定義 `shared/matrixProtocol.ts`。
3. UIコンポーネント
   - Dialog骨組み + Toolbar（ファイルラベル、フィルタ・エクスポートボタン、統計表示）。
   - Cell: ステータス色、ハイライト枠、ツールチップ（カードID/タイトル preview）。
   - FilterPanel: 画像の「行/列フィルタ解除」ボタン再現、カードID/タイトルテキストフィルタ、ステータス/種別チェック群。
4. フック・ユーティリティ
   - `useMatrixGrid`: TanStack Table列生成、react-window連携、フィルタ適用。
   - `useMatrixIPC`: IPC購読/クリーンアップ、楽観更新 + サーバー差分反映。
   - `matrixExport`: CSV/Excel writer、UIからのパラメータ(フィルタ状態/表示列)反映。
5. 連動と統合
   - CardPanelにマトリクス起動ボタン追加、選択イベント broadcast。
   - traceStore に `getTraceMatrix` + cache invalidation 追加。
   - workspaceStore に `applyMatrixTraceUpdate` フック。
6. リグレッション & 文書
   - 既存E2E/ユニットを再実行、Playwrightでシナリオ6件(技術資料参照)を自動化。
   - `doc/software_detail_design.md` 等の設計ドキュメント更新。

## 5. リスクと対策適用ポイント
- **パフォーマンス**: セルをReact.memo化し、react-window `FixedSizeGrid` で視覚領域のみ描画。フィルタ入力は `useDeferredValue` で遅延。(対応箇所: Phase2, Phase3)
- **IPC遅延**: matrixStoreで楽観的にrelationsを更新し、保存失敗時にロールバック。イベント送信は `requestAnimationFrame` でまとめ、100ms以内に反映。(Phase1, Phase5)
- **メモリリーク**: matrixStore `reset()` を `window.onbeforeunload` で呼ぶ、IPC購読は `useEffect` cleanupで解除。(Phase1, Phase5)
- **既存機能影響**: traceStore/workspaceStore変更はAPI追加方式とし、既存UIは従来selectorを利用。差分テストで回帰確認。(Phase5)

## 6. テスト計画
- **単体 (Jest)**: matrixStore、matrixFilter、matrixExport、IPCハンドラ(モック)。(根拠: `doc/tech_design_trace_matrix.md:1303-1333`)
- **統合 (Testing Library)**: TraceMatrixDialogのセル描画、セルクリックでのトグル、コンテキストメニューの種別変更。(根拠: `doc/tech_design_trace_matrix.md:1342-1370`)
- **E2E (Playwright)**: ウィンドウ起動/クローズ、トレース作成、種別変更、フィルタ、カード選択連動、エクスポートの6シナリオ。(根拠: `doc/tech_design_trace_matrix.md:1374-1404`)

## 7. 次アクション
1. Phase0チェックリストをjournalに記録し、cardId/deprecated機能の反映状況を確認。
2. matrixStoreとIPC骨組みを作成し、Jestテストを先行で用意（TDD開始）。
3. UI実装に入る前に画面イメージの配色トークンを `styles.css` / Tailwind設定へ落とし込み、ライトモード再現を確認。

## 8. Phase1着手ログ（2025-11-15）
- `src/renderer/store/workspaceStore.test.ts` の `mergeCards` シナリオでスコープ外宣言だった `mergeCandidates` と型取得ロジックを修正し、`MergeCardsReturn` 型エイリアスを導入。`npm run test:unit` が再度パスしたことを確認。
- 現状のIPCは `src/main/main.ts:31-230` で一元管理され、`workspace:loadTraceFile/saveTraceFile` のように `ipcMain.handle` から `workspace.*` API を公開している。`src/main/preload.ts:18-120` では `contextBridge` により `window.app.workspace` へ `loadTraceFile`/`saveTraceFile` をエクスポート済み。Phase1ではここに `matrix:open` / `matrix:close` / ブロードキャスト系イベントを追加し、`MatrixWindowManager` で複数 `BrowserWindow` を追跡する。
- レンダラー側状態管理は `useWorkspaceStore`/`useTraceStore` が既に稼働。マトリクス専用の `matrixStore` と IPCフックは未実装のため、Phase1.1で `src/renderer/store/matrixStore.ts` と `src/renderer/hooks/useMatrixIPC.ts` を新規に追加する計画。
- Phase1実装：`src/main/matrixWindowManager.ts` を新設し、`matrix:open/close` によるモーダレスウィンドウ生成と `matrix:init`/`matrix:trace-changed`/`matrix:card-selection` ブロードキャストを `src/main/main.ts:200-270` へ追加。preload/global.d.tsには `window.app.matrix.*` API を公開。レンダラー側では `src/renderer/store/matrixStore.ts` と `src/renderer/hooks/useMatrixIPC.ts` を実装し、カード/トレース初期ロード、ハイライト反映、beforeunload時のClose通知までの基盤を整備した。
