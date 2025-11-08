# mdsplitter 詳細設計

最終更新日: 2025-11-02  
対象リポジトリ: `mdsplitter_copy_codex`

## 1. システム概要
- 目的: 自然言語ドキュメントをカード単位に構造化し、階層・トレーサビリティを含む編集を可能にする Electron/React/TypeScript 製デスクトップアプリ。
- 現状コード: Electron メインプロセス/プリロード (`src/main/`)、Vite ベースのレンダラースケルトン (`src/renderer/`)、IPC ハンドシェイク (`app:ping`) とステータス表示 UI を含む骨格を実装。既存サンプル (`Hello`/`sum`) も残存。
- 運用前提: Node.js 22.20.0、npm 10.8.0 以上。`npm run dev` は Vite ウォッチ + TypeScript ウォッチ + Electron の 3 並列で動作する。WSL2 では Electron が GUI 非対応のため、Windows/macOS/Linux GUI 環境での起動確認が必要 (WSL2 ではビルド・テストのみ実行可能)。

## 2. フォルダ・ファイル構成
凡例: ✅=実装済み / ⚠️=テンプレート・スタブのみ / ⛔=未作成

### 2.1 ルートディレクトリと主要フォルダ
| パス | 役割 | 備考 | 状況 |
| --- | --- | --- | --- |
| `src/` | アプリケーション本体 | `main/` (Electron) と `renderer/` (React) に分割。 | ⚠️ |
| `src/main/` | Electron メイン/プリロード | ブラウザウィンドウ生成と IPC スタブを実装。 | ⚠️ |
| `src/renderer/` | Vite + React レンダラー | Skeleton UI と `window.app` 経由のハンドシェイク確認を実装。 | ⚠️ |
| `tests/` | Playwright E2E テスト | `tests/e2e/smoke.spec.ts` で最小限の smoke テスト。 | ⚠️ |
| `test-results/` | Jest/Playwright 実行結果 | `.last-run.json` に最新実行情報を保存。 | ⚠️ |
| `spec/` | 要求・UI 仕様書 | `SW要求仕様書.md`、`UI設計書.md` が要件源泉。 | ✅ |
| `doc/` | ドキュメント類 | `操作ガイド.md` (操作ガイド骨子) と本ファイル。 | ⚠️ |
| `task/` | タスク計画 | `task_all.md` にフェーズ別 WBS。 | ✅ |
| `journal/` | 作業ログ | 日次記録 (`journal_YYYYMMDD.txt`) を格納。 | ✅ |
| `node_modules/` | npm 依存パッケージ | `package-lock.json` 管理。 | ✅ |

### 2.2 設定ファイルと補助スクリプト
| ファイル | 位置 | 概要 | 状況 |
| --- | --- | --- | --- |
| `package.json` | ルート | アプリ情報、依存関係、npm スクリプト定義。`npm run dev`=Viteウォッチ+tscウォッチ+Electron起動、`npm run build`=Vite→tsc。 | ⚠️ |
| `package-lock.json` | ルート | npm 依存バージョン固定。 | ✅ |
| `tsconfig.json` | ルート | TypeScript 設定。`@/*` エイリアス。`noEmit`。 | ✅ (設定) |
| `tsconfig.main.json` | ルート | Electron メイン/プリロードのトランスパイル設定 (`dist/main` 出力)。 | ⚠️ |
| `jest.config.cjs` | ルート | Jest 設定。`ts-jest` プリセット/`jsdom`。 | ✅ (設定) |
| `jest.setup.ts` | ルート | Jest DOM カスタムマッチャ導入 (`@testing-library/jest-dom`)。 | ✅ |
| `playwright.config.ts` | ルート | Playwright 設定。Chromium プロジェクト (WSL2 では `--no-sandbox` 相当の対応が必要)。 | ✅ |
| `vite.config.ts` | ルート | Vite 設定。`src/renderer` をルートに `dist/renderer` へ出力し、`base: './'` で Electron の `file://` 読み込みでもアセット解決可能にしている。 | ⚠️ |
| `.eslintrc.cjs` | ルート | ESLint ルール。React/TypeScript/Testing Library/Import プラグイン。 | ✅ |
| `.eslintignore` | ルート | Lint 対象外定義 (`node_modules` 等)。 | ✅ |
| `CONTRIBUTING.md` | ルート | 開発フロー・コミットガイドライン。 | ⚠️ (骨子) |
| `AGENT.md`, `CLAUDE.md` | ルート | AI エージェント運用メモ。 | ⚠️ |

### 2.3 ソースコード構成
| パス | 主な内容 | メモ | 状況 |
| --- | --- | --- | --- |
| `src/main/main.ts` | BrowserWindow 生成、設定/ワークスペース初期化、IPC ハンドラ登録。 | WSL2 では Electron 自体が GUI 動作不可、GUI ホストで確認する。 | ⚠️ |
| `src/main/preload.ts` | `window.app` API を公開する contextBridge。 | 設定読み書き・ログ出力・ping を公開。 | ⚠️ |
| `src/main/logger.ts` | ログレベル制御とファイルローテーションを担当するロガー。 | `settings.json` の logging セクションを参照し出力。 | ⚠️ |
| `src/main/workspace.ts` | ワークスペースディレクトリ生成と設定ファイル管理。 | `_input/_out/_logs` 作成とサンプルファイル配置、設定既定値を提供。 | ⚠️ |
| `src/main.ts` | レンダラエントリ移行後の互換プレースホルダ。 | 旧インポート経路維持のみを目的とした空モジュール。 | ⚠️ |
| `src/renderer/main.tsx` | React エントリポイント。`App` を `#root` にマウント。 | Vite ビルド対象。 | ⚠️ |
| `src/renderer/store/workspaceStore.ts` | 分割パネルごとのタブ/カードを管理する Zustand ストア。 | パネル⇔タブ⇔カードのマッピング、ファイル排他 (同一ファイルの多重オープン禁止)、カード更新/移動/追加/削除と Undo/Redo スタック、保存フラグ更新を実装。 | ⚠️ |
| `src/renderer/store/uiStore.ts` | テーマ設定ストア。ライト/ダークモードのトグルを提供。 | Tailwind ダークモード制御に利用。 | ⚠️ |
| `src/renderer/store/notificationStore.ts` | 共通通知(トースト)の状態管理。 | レベル別のメッセージ表示と自動消去を担当。 | ⚠️ |
| `src/renderer/App.tsx` | レイアウト骨格 (メニュー/ツールバー/サイドバー/カード/ログ/ステータス) と IPC ステータスログ、リサイズ制御を実装。 | コンパクトモードでの余白調整とテーマ切替を保持。 | ⚠️ |
| `src/renderer/styles.css` | Tailwind 基礎スタイルと `@apply` によるコンポーネントスタイル。ライト/ダークテーマに対応。 | 文字サイズ・余白を小さくしたコンパクトデザインを適用。 | ⚠️ |
| `src/vite-env.d.ts` | Vite クライアント型補完の参照ディレクティブ。 | 実装コードは含まず型補助のみ提供。 | ✅ |
| `src/components/Hello.tsx` | 挨拶コンポーネント。プロパティ `name` を受け取り、`role="status"` の段落で表示。 | テスト: `src/components/Hello.test.tsx`。日本語挨拶の確認のみ。 | ✅ (サンプル) |
| `src/utils/sum.ts` | 純粋関数 `sum(a, b)` を提供。 | テスト: `src/utils/sum.test.ts`。 | ✅ (サンプル) |
| `src/sum.ts` | ルート直下のサンプル `sum` 関数。 | テスト: `src/sum.test.ts` が正整数と負数の正常系を検証。 | ✅ (サンプル) |
| (未実装) | メインレイアウト/状態管理/ファイル I/O 等の本機能コード | `task/task_all.md` のフェーズ 1 以降で実装予定。 | ⛔ |

#### 2.3.1 コネクタ描画関連コンポーネント（計画）
| パス | 主な内容 | 備考 | 状況 |
| --- | --- | --- | --- |
| `src/renderer/components/TraceConnectorLayer.tsx` | 隣接する左右パネル間のコネクタを SVG で描画するレイヤ。 | SVG `<path>` ベース、種別フィルタ/選択フォーカス/可視トグルに対応済み。 | ✅ |
| `src/renderer/store/tracePreferenceStore.ts` | コネクタ表示設定（可視・種別チェックボックス・選択カード限定表示）を保持する Zustand ストア。 | ツールバーのトグルと `TraceConnectorLayer` が同一ソースを参照。 | ✅ |
| `src/renderer/utils/traceLayout.ts` | 分割ノードツリーから左右葉IDを収集し、アクティブ葉が属する垂直分割ペアを特定する。 | トレース作成/削除操作で左右ファイルの決定に利用。 | ✅ |
| `src/renderer/store/connectorLayoutStore.ts` | カード要素の位置情報と可視状態を保持するストア。 | ResizeObserver/MutationObserver を用いて DOM 位置をトラッキング。 | ⚠️ |
| `src/renderer/hooks/useConnectorLayout.ts` | カードコンポーネントから位置情報を登録/更新するフック。 | `CardPanel` 内のカード要素に適用し、アンカー座標を測定。 | ⚠️ |
| `src/shared/traceability.ts` | コネクタ定義（方向・種類・スタイル）の共通型。 | 後続フェーズでメイン/レンダラ間共有。 | ⚠️ |

## 3. ユースケース一覧
全ユースケースは仕様段階であり、現行コードには未実装。ステータスを明示する。

| UC ID | ユースケース | 概要 | 主要アクター | 成功条件 | 実装状況 |
| --- | --- | --- | --- | --- | --- |
| UC-01 | ワークスペース初期化 | `_input/`, `_out/`, `_logs/`, `settings.json` を生成し既定設定をロード。 | ユーザ、設定管理モジュール | 必要フォルダ/ファイル生成と UI 反映。 | ⚠️ |
| UC-02 | 文書取り込み | `.md`/`.txt` の文字コード判定・サイズチェック後にコピー。 | ユーザ、ファイル I/O モジュール | `_input/` 配下に保存し読み込み成功。 | ⛔ |
| UC-03 | カード変換（固定ルール） | 共通ルールで文書をカード化し JSON へ保存。 | ユーザ、カード変換モジュール | `_out/` にカード JSON 保存、ログ出力。 | ⛔ |
| UC-04 | カード変換（LLM） | LLM アダプタで分割し監査情報と共に保存。 | ユーザ、LLM アダプタ | JSON 保存、監査ログ出力。 | ⛔ |
| UC-05 | カード編集 | カード CRUD、ステータス操作、Undo/Redo。 | ユーザ、カード編集 UI | ストアとファイル整合、未保存状態表示。 | ⛔ |
| UC-06 | トレーサビリティ管理 | カード間リンク追加/削除と可視化。 | ユーザ、トレーサ管理モジュール | `trace_*.json` 更新、ビュー反映。 | ⛔ |
| UC-07 | 検索・フィルタ | 種別/ステータス/テキストで絞り込み。 | ユーザ、検索モジュール | 条件一致カード表示と親展開。 | ⛔ |
| UC-08 | 設定変更と即時反映 | `settings.json` や UI からの設定変更を即時反映。 | ユーザ、設定モジュール | バリデーション通過と変更反映ログ。 | ⚠️ |
| UC-09 | ログ監査 | 操作ログ収集とローテーション。 | ユーザ、ログモジュール | ログが閾値管理され監査要件満足。 | ⛔ |

## 4. 処理フロー (PlantUML)
以下のダイアグラムは要求仕様ベースの将来設計であり、現行コードには対応処理が存在しない。

### 4.1 カード変換アクティビティ図
```plantuml
@startuml
start
:ユーザが入力文書を選択;
:メインプロセスがファイル情報を検証;
if (サイズ > 警告閾値?) then (はい)
  :警告ダイアログ表示;
  if (ユーザ継続?) then (続行)
  else (キャンセル)
    stop
  endif
endif
:文字コード判定と改行正規化;
:設定から変換方式を取得;
if (LLM方式?) then (はい)
  :LLMアダプタでプロンプト生成;
  :API 呼び出しと応答の正規化;
else (いいえ)
  :固定ルールコンバータを実行;
endif
:階層/トレーサ初期化;
:カードJSON・ログを保存;
stop
@enduml
```

### 4.2 カード編集シーケンス図
```plantuml
@startuml
actor User
participant RendererUI as "Renderer UI\\n(React)"
participant CardStore as "Card Store\\n(状態管理)"
participant MainProcess as "Electron Main"
participant Workspace as "Workspace Files"

User -> RendererUI : カード編集操作
RendererUI -> CardStore : dispatch(updateCard)
CardStore --> RendererUI : 更新後の状態
RendererUI -> RendererUI : バリデーション/差分検知
RendererUI -> MainProcess : invoke('workspace/save', payload)
MainProcess -> Workspace : writeFile(card.json)
Workspace --> MainProcess : 保存完了
MainProcess --> RendererUI : 完了応答
RendererUI -> User : UI更新・トースト通知
@enduml
```

### 4.3 カード状態遷移図
```plantuml
@startuml
[*] --> Draft
Draft --> Review : レビュー依頼
Review --> Draft : 修正リクエスト
Review --> Approved : レビュー完了
Approved --> Deprecated : 廃止決定
Deprecated --> Draft : 再利用
@enduml
```

## 5. ライブラリ利用状況

### 5.1 本番依存
| ライブラリ | 用途 | 主な利用箇所 | 実装状況 |
| --- | --- | --- | --- |
| `react` | UI コンポーネントフレームワーク | `src/renderer/App.tsx`、`src/components/Hello.tsx`。 | ⚠️ |
| `react-dom` | React レンダラー | `src/renderer/main.tsx` で `App` をマウント。 | ⚠️ |
| `zustand` | グローバル状態管理（Zustand） | `src/renderer/store/workspaceStore.ts`、`src/renderer/App.tsx`。 | ⚠️ |
| `tailwindcss` | ユーティリティファースト CSS フレームワーク | `src/renderer/styles.css`、`tailwind.config.js`。 | ⚠️ |
| `postcss` | Tailwind ビルドチェーン | `postcss.config.js`。 | ⚠️ |
| `autoprefixer` | CSS プレフィックス自動付与 | `postcss.config.js`。 | ⚠️ |

### 5.2 開発・テスト依存
| カテゴリ | ライブラリ | 用途 | 実装状況 |
| --- | --- | --- | --- |
| 型/言語 | `typescript`, `ts-node`, `ts-jest` | TypeScript 利用、Electron/テスト連携。 | ⚠️ (設定のみ) |
| 単体テスト | `jest`, `@types/jest`, `jest-environment-jsdom` | フロントエンドテスト基盤。 | ⚠️ (sum/Hello/Skeleton) |
| コンポーネントテスト | `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` | UI 振る舞い検証。 | ⚠️ (サンプルのみ) |
| E2E テスト | `@playwright/test`, `wait-on`, `cross-env` | Chromium ベースの自動テスト。WSL2 は `--no-sandbox` 前提。 | ⚠️ (Smoke のみ) |
| Lint/整形 | `eslint`, `@typescript-eslint/*`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-testing-library`, `eslint-plugin-jest-dom`, `eslint-plugin-import`, `eslint-config-prettier`, `prettier` | コード品質管理。 | ✅ (設定活用可) |
| デスクトップ | `electron` | メイン/レンダラープロセス構築。 | ⚠️ (Skeleton 実装) |
| ビルド/実行補助 | `vite`, `@vitejs/plugin-react`, `concurrently` | レンダラービルドと並列実行管理。 | ⚠️ |

### 5.3 エンジン・ツール前提
- Node.js: 22.20.0 (必須エンジンとして `package.json` に明示)。
- npm: 10.8.0 以上。
- PlantUML: 本ドキュメントの図式表現用 (サーバー/CLI いずれかで描画想定、生成プロセス未構築)。

### 5.4 ワークスペーススナップショット
- 保存先: `_out/workspace.snapshot.json` (`WORKSPACE_SNAPSHOT_FILENAME`)。
- フォーマット:

```json
{
  "cards": [
    {
      "id": "card-001",
      "title": "プロジェクト概要",
      "body": "…",
      "status": "approved",
      "kind": "heading",
      "hasLeftTrace": true,
      "hasRightTrace": true,
      "markdownPreviewEnabled": true,
      "updatedAt": "2025-11-03T09:15:00.000Z"
    }
  ],
  "savedAt": "2025-11-03T09:15:05.000Z"
}
```

- バリデーション: `src/shared/workspace.ts:1-73` の `isWorkspaceSnapshot` が id/title/body 等の必須フィールドをチェック。
- I/O: `src/main/main.ts:82-133` が `workspace:save` / `workspace:load` IPC を提供し、`src/main/workspace.ts:19-168` で JSON を読み書きする。
- レンダラー: `src/renderer/App.tsx:146-466` が初回マウント時に `workspace.load` を呼び出してストアへハイドレートし、保存完了後も `Ctrl+S` で同ファイルを更新する。

## 6. 実装進捗と今後の観点
- フェーズ P1-03: UI 設計書に沿ったレイアウト骨格（メニュー/ツールバー/サイドバー/カードパネル/ログ/ステータスバー）をプレースホルダで構築し、サイドバー幅とログエリア高さのドラッグリサイズを実装済み。次工程ではグローバルストア連携と実データ描画を進める。
- フェーズ P1-04: Zustand ストアを導入し、カードダミーデータの表示とステータス更新アクションを UI へ接続。ストアの単体テストおよび App コンポーネントの振る舞いテストを追加済み。次フェーズでは実データソースへの接続やストア分割を検討する。
- フェーズ P1-05: Tailwind CSS を導入し、`App` 全体を `@apply` ベースのユーティリティスタイルに刷新。テーマ設定ストアを新設し、ライト/ダークモード切替が UI 全域に反映される基盤とテストを整備。以降は実データ/コンポーネント化時に Tailwind の抽象化を進める。
- フェーズ P2-01: `settings.json` の読み書き API を実装し、テーマ設定を IPC 経由で同期。設定読込/保存結果をログへ記録する処理を追加。
- フェーズ P2-02: `app.getPath('userData')` 配下に `_input/_out/_logs` を自動生成し、サンプル入出力ファイルと初期ログを配置するワークスペース初期化を実装。
- フェーズ P2-03: ファイルロガーを実装し、ログレベル設定とサイズローテーションに対応。レンダラからのログ送信 API を整備し、設定変更時にロガーへ反映するよう調整。
- フェーズ P2-04: 共通通知コンポーネントと Zustand ストアを実装し、テーマ設定やエラーハンドリングで再利用。Tailwind スタイルでトースト表示を整備し、自動消去と手動閉じを提供。
- フェーズ P2-05: `src/renderer/App.tsx` で保存 (`Ctrl+S`)、上下/左右分割 (`Ctrl+Shift+\\` / `Ctrl+\\`)、検索 (`Ctrl+F`) のショートカットマッピングを実装。`src/shared/workspace.ts` にカードモデル/スナップショット共通型・バリデーション (`isWorkspaceSnapshot`/`CARD_KIND_VALUES`) を定義し、`src/main/preload.ts`・`src/main/main.ts`・`src/main/workspace.ts` で `workspace:save/load` IPC を通じて `_out/workspace.snapshot.json` を読み書きする。読み込み時にカード内容を検証し、無効カードがあれば除外してトースト通知・ログ出力を行う。ステータスバーと `split-grid` レイアウト (`styles.css`) に保存状態と分割モードを反映し、`src/renderer/App.test.tsx` でショートカット操作と保存・バリデーションの UI テストを追加。
- フェーズ P2-09a/b: `src/renderer/store/workspaceStore.ts` をタブ指向設計へ刷新し、葉ノード毎にタブ配列・アクティブタブ・カード一覧・未保存フラグを保持。`openTab/closeTab/closeLeaf` でカードファイルをタブ化し、同一ファイルの複数パネル展開を禁止 (`fileToLeaf` マップ) する。`src/renderer/CardPanel.tsx` はタブバー/タブ閉じボタン/空表示メッセージを描画し、`App.tsx` はタブ状態を利用して保存・ステータス更新・ファイル読み込みをアクティブパネル単位で処理する。`styles.css` にタブ用クラス (`tab-bar__tab-container` 等) を追加し、`workspaceStore.test.ts` と `App.test.tsx` でタブ管理・重複禁止のユニット/統合テストを整備。
- フェーズ P4-01: タブバー右端の「＋」ボタンから `workspaceStore.createUntitledTab` を呼び出し、`fileName=null` の仮タブを生成できるようにした。未保存タブは `title` に「新規ファイル n」形式の連番を割り当て、`isDirty=true` のまま保存を促す。`saveActiveTab` は `fileName` が無い場合に自動で保存名ダイアログを表示し、保存後は `renameTabFile` で `fileToLeaf` マップへ登録される。UI では `CardPanel` の「＋」ボタンを有効化し、タブ生成時にログへアクションを記録する。`CardListItem` にはファイル名の代わりにタブIDを渡すフォールバックを導入し、トレース用アンカー識別子が維持される。`workspaceStore.test.ts` へ未保存タブ生成のユニットテストを追加して回帰を防止。
- フェーズ P2-17: `workspaceStore.addCard/deleteCards` を実装し、選択中カードの同階層直下に即時挿入・サブツリーごとの削除と Undo/Redo 復元をストアで完結させた。`addCard` は `position(before/after/child)` と `anchorCardId` を受け取り、兄弟/子挿入を一律に処理する。`CardPanel.tsx` のツールバーに挿入モードセレクタと「追加/削除」ボタンを設置し、右クリック専用コンテキストメニューでも前/後/子の挿入を選択できるようにした。さらに `App.tsx` へ `Ctrl+Alt+ArrowUp/Down/Right` のショートカットと既存 `Insert`/`Delete` ハンドラを拡張してログ・通知連携を行い、`workspaceStore.test.ts` に前/後/子挿入と削除ケースを追加して回帰を防止。
- フェーズ P2-18-1/2: `workspaceStore` にカードツリーを保持するクリップボードと `copySelection/pasteClipboard` を追加し、複数選択コピー・貼り付けと Undo/Redo を実装。貼り付け位置は前/後/子とアンカー指定に対応し、`lastInsertPreview` を用いて UI 側へ挿入位置を配信する。`CardPanel` ではツールバーとコンテキストメニューにコピー/ペースト操作を追加し、`Ctrl+C`/`Ctrl+V` 連携、貼り付け時のハイライト、青い挿入ラインによるドロップゾーン表示、ドラッグ中カードの半透明プレビューを実装。`CardListItem` は HTML5 Drag API を利用したドロップ判定とプレビュー描画を担い、`styles.css` へ drop-indicator/hightlight アニメーションを追加した。`workspaceStore.test.ts` にはコピー/貼り付けシナリオを追加し回帰を防いでいる。
- フェーズ P2-19: JSON 読み込み時に `normalizeCardOrder` でカード配列を事前整列し、親カード→子カードの順で深さ優先のリストに正規化してからタブへハイドレートする。兄弟順序は元ファイルの `child_ids` を優先しつつ、欠落分は元データの出現順で補完。整列後に `rebuildSiblingLinks` で `prev_id`/`next_id`/`child_ids` を再生成することで、表示と内部リンクの整合性を常に保証する。
- トレーサビリティの追従: カード構造が変化した際に `workspaceStore` が `mdsplitter:card-layout-changed` カスタムイベントを発火し、`useConnectorLayout` がリッスンしてアンカー座標を再計測する。これによりカード移動/追加/削除/貼付直後でもコネクタレイヤ（`TraceConnectorLayer`）が最新位置へ即座に追従する。
- フェーズ P2-20: `SettingsModal` コンポーネントを追加し、メニューバー「編集」または `Ctrl+,` で呼び出せる設定ダイアログを実装。テーマ/入出力/ログ/ワークスペースの各セクションを左右2ペインで表示し、保存時に `window.app.settings.update` を介して `settings.json` に反映、Undo不要で即時通知する。テーマモードと分割境界幅はプレビュー対応としてドラフト変更時に `applyThemeFromSettings` を通じてリアルタイム反映し、キャンセル時は既存設定にロールバックする。`App.tsx` で設定状態を保持し、`styles.css` にモーダル用スタイルを追加した。
- カードパネルのスクロール領域: `src/renderer/styles.css:210-312` で `.tab-bar`/`.panel-toolbar` を `flex-shrink-0`、`.panel-cards` を `flex-1 min-h-0 overflow-y-auto` とし、タブバーとツールバーを常時表示したままカード一覧だけを独立スクロールさせる。`src/renderer/components/CardPanel.tsx:705-758` では `panelScrollRef` を `CardListItem` へ渡し、`useCardConnectorAnchor` がスクロールイベントで接合点座標を再計測するため、スクロール後もトレーサビリティコネクタがカード位置へ追従する。
- 分割レイアウトのビューポート拘束: `body` を `overflow-hidden`、`.app-shell` を `h-screen`/`min-h-0`、`.workspace` を `h-full` に設定してビューポート全体の高さを固定したうえで、`panels__body` をフレックスコンテナ化 (`src/renderer/styles.css:188-196`) し、`split-node` (`同:213-217`) に `flex-1 h-full` を付与した。さらに `split-leaf__viewport` ラッパー (`src/renderer/components/SplitContainer.tsx`, `styles.css:640-648`) を挟むことで各カードパネルが自分のスプリット領域に固定され、カード枚数が増えても `panel-cards` の独立スクロールだけで対応できる構造にした。
- フェーズ P2-21a: ドラッグ中の挿入位置を可視化するため、`CardPanel.tsx:900-980` で `card__drop-indicator` にラベル付き要素を追加し、兄弟挿入時に「ここに挿入（前/後）」を表示。子挿入時は `.card__drop-child-overlay` を描画し、「子として追加」バッジと枠線で階層変更を明示。対応するスタイルを `src/renderer/styles.css:300-330,472-520` に追加し、カード要素を `position: relative` に変更してオーバーレイをサポートした。
- フェーズ P2-21b: 保存フローをカードファイル単位に刷新。`workspaceStore` へ `renameTabFile` を追加し、`App.tsx:800-930` の `saveActiveTab` で `window.app.workspace.saveCardFile`（新規IPC）を通じて `_out/` 配下へ JSON を出力。`main/workspace.ts:330-370` に `saveCardFileSnapshot` を実装し、`workspace:saveCardFile` ハンドラを `main.ts:120-150`、`preload.ts:30-80`、`global.d.ts:20-40` に追加。ツールバーへ「📝 別名保存」ボタンを配置し、`Ctrl+Shift+S` ショートカットでリネーム保存、保存後は `renameTabFile` でタブのファイル名/タイトルを更新する。
- P1-05 追加対応: 文字サイズと余白を見直し、全 UI をコンパクト表示（text-sm 基準、ツールバー/ステータスバー高さ縮小、ログエリア 112px）へ調整。
- `npm run dev` は GUI 対応 OS 上で実行してウィンドウ起動を確認する。WSL2 では `electron` が GUI を持たず、メインプロセス API (`ipcMain`) が未定義となるためテスト/ビルドのみ実施し、GUI 検証は Windows/macOS/Linux ホストで行う。
- ファイル I/O、カード変換、トレーサ管理などのコア機能はすべて未実装。仕様は `spec/SW要求仕様書.md` 章 2〜7、`spec/UI設計書.md` を参照し詳細設計へ落とし込む。
- テスト基盤は Jest/Playwright の設定が存在するが、網羅的なテストケースは未作成。機能実装に伴いユニット・統合・E2E テストを拡充する。
- ドキュメント更新は仕様変更と連動させる必要があり、本ファイルも実装進捗に合わせてステータスを更新すること。


## 8. トレーサビリティコネクタ設計方針
本節では P2-10 以降で実装予定のコネクタ描画基盤について、技術選定書（`spec/traceability_connector_tech_decision.md`）を踏まえた具体的な構成を整理する。

### 8.1 採用方針概要
- **描画方式**: SVG `<path>` を用いたベクタ描画。Canvas へ切り替える判断基準は 1,000 本超のコネクタで FPS < 24 が継続した場合とする。
- **レンダリングレイヤ**: `TraceConnectorLayer` をパネル領域最上位に重ね、左右に隣接するスプリットペア単位で SVG を生成する。
- **データ取得**: Zustand ベースの `connectorLayoutStore` にカード要素のアンカー座標と可視領域をキャッシュし、スクロール/リサイズ時は requestAnimationFrame でバッチ更新する。
- **スタブデータ**: P2-11 まではローカルスタブ (`traceability.stubs.ts`) を使用し、将来的にメインプロセスのトレーサビリティ API と連携する。

### 8.2 コンポーネント構成
1. `TraceConnectorLayer`
   - `SplitContainer` の下層に配置し、対象の左右ペアを検出。
   - ペアごとに `<svg>` 要素を生成し、可視カード間の Connector パスを描画。
2. `ConnectorPath`
   - 1 本のコネクタを担当する純粋コンポーネント。
   - 曲線制御点は `bezierControlPoints(from, to)` で算出、種別に応じたクラス名を付与。
3. `useConnectorLayout`
   - `CardPanel` 内の `article.card` 要素に `data-card-id` を付与して DOMRect を測定。
   - ResizeObserver/MutationObserver で変化を捕捉し、store へ反映。
4. `connectorLayoutStore`
   - `cards: Record<CardId, AnchorRect>`、`panels: Record<LeafId, PanelRect>` を保持。
   - `updateCardAnchor`, `removeCard`, `setPanelScroll` などのアクションを提供。

### 8.3 フェーズ別タスク細分化案
- **P2-10a**: `TraceConnectorLayer` の土台を実装し、左右ペア判定と SVG コンテナの表示を行う。ダミー座標を用いた単一コネクタ描画でレンダリング経路を検証する。
- **P2-10b**: `useConnectorLayout`/`connectorLayoutStore` を導入し、カード DOM からアンカー座標を収集。スクロール・リサイズに追従するよう更新処理を整備する。→ 実装着手済み（ResizeObserver＋scroll イベントで計測）。
- **P2-10c**: スタブトレースデータとカード ID を紐付け、左右パネル双方で存在するカードのみコネクタ化。方向性・種別に応じたスタイル付与、ハイライト状態の受け口を設置。→ 実装着手済み（`traceability.ts` にスタブ定義）。
- **P2-11**: コネクタ描画の統合テスト（React Testing Library + DOMRect モック）と Storybook/Playwright 用のスタブシナリオを追加し、負荷検証の取っ掛かりを用意。→ 第一段として jest ベースのユニットテスト・Node ベンチスクリプトを整備。
- **先行検討 (P2-12 以降)**: カード折畳みとの連動、トグル表示、ホバー/選択インタラクション、ライン編集 UI を順次追加。

### 8.4 将来拡張ポイント
- コネクタ本数が閾値を超えた場合、SVG 内で `visibility` 切替と仮想化を行う。
- トレーサビリティ編集機能（ドラッグ、新規作成）は専用 Interaction Layer を追加し、命令はストア経由でメインプロセスと同期する。
- WebGL / Canvas へのスイッチを想定し、コネクタ描画ロジックはアダプタパターンで分離する。

### 8.5 ベンチマーク・スタブシナリオ
- `scripts/trace-benchmark.js` を追加し、100/500/1000/2000 本のコネクタ生成時間を計測する CLI (`npm run perf:trace`) を整備。
- `src/renderer/components/__tests__/TraceConnectorLayer.test.tsx` で DOMRect モックを用いた描画確認テストを追加し、P2-11a のスタブシナリオを最小構成で実現。
- メイン/プリロードへ `workspace.loadTraceFile` API を追加し、`traceStore` 経由で左右アクティブタブのペアが切り替わる度にトレーサファイルを読み込み・キャッシュするルートを構築 (P2-10d)。

### 8.6 P5 フィーチャ実装サマリ
- **P5-01 データモデル/永続化**
  - `src/shared/traceability.ts` にヘッダ構造 (`TraceabilityHeader`)、relation ID、`TRACEABILITY_FILE_SCHEMA_VERSION`、`relationsToLinks` などを追加し、カード間リンクが JSON で往復できるスキーマを明文化。
  - メインプロセスの `workspace.saveTraceFile` / `workspace.loadTraceFile` が新スキーマを読み書きし、`preload.ts`・`global.d.ts` を介して `window.app.workspace.saveTraceFile` を公開。
  - `src/main/__tests__/workspace.traceability.test.ts` と `src/shared/traceability.test.ts` でヘッダ付ファイルの永続化・読み込み・方向スワップ補正を検証。
- **P5-02 コネクタ作成/削除**
  - ツールバーに `➡️/⬅️/↔️/💔` ボタンを実装 (`src/renderer/App.tsx:1600-1700` 付近)。左右パネルの選択カードを検出し、`useTraceStore.saveRelationsForPair` が relation の追加/削除と `_out/trace_*.json` 更新を司る。
  - `workspaceStore` に `setCardTraceFlags` を追加し、relation 変化に応じて各カードの `hasLeftTrace`/`hasRightTrace` を反映。Undo スタックに影響を与えずに dirty フラグのみを立てる。
  - 垂直分割ペアの探索を `src/renderer/utils/traceLayout.ts` に切り出し、トレース操作と `TraceConnectorLayer` の双方で共通利用。
- **P5-03 表示フィルタ/可視トグル**
  - `src/renderer/store/tracePreferenceStore.ts` で可視状態・還流制御・種別別チェックボックスを管理。`TraceConnectorLayer` はこのストアを購読し、フィルタ条件に合致しないリンクを描画から除外。
  - グローバルツールバーの `⛓️` トグル、`🔁` 還流許可トグル、`🧬` タイプフィルタポップオーバーを実装。ポップオーバーは CSS (`src/renderer/styles.css`) で簡易レイヤーを提供。
  - `src/renderer/store/__tests__/tracePreferenceStore.test.ts`・`traceStore.test.ts` で設定ストアと relation 永続化の挙動をユニットテストし、Playground なしでも挙動を担保。
- **P5-04 選択カードフォーカス/強調**
  - `panelEngagementStore` を新設し、クリック/Shift/Ctrl 選択ごとに「アクティブ / 準アクティブ / 非アクティブ」の3段階をパネル単位で管理。カード側も `card--selected-primary`/`card--selected-secondary`/`card--selected-inactive` の3種クラスで状態を明示し、スタイルは `styles.css` でカスタマイズできる。
  - `TracePreferenceStore.excludeSelfTrace` を `🔁` 還流許可ボタンに割り当て、OFF の場合は従来通り自パネルを含む数珠繋ぎ強調、ON の場合は選択カードを除き自パネルへ還流したノードをハイライト対象から除外する。`CardPanel`/`TraceConnectorLayer` が `getRelatedCards` の結果をもとに描画を切り替える。
  - カード左右の接合点は件数バッジ付きボタンとなり、`toggleCardVisibility` でカード単位にコネクタ表示を個別制御できる。`aggregateCountsForFile` が左右別件数を提供し、トグルは panel/panel で同期する。
- **P5-05 種別選択 UI**
  - トレース作成用の relation セレクタをツールバーへ追加し (`App.tsx`)、`useTracePreferenceStore.creationRelationKind` によって新規コネクタの `type` を決定。表示側は `🧬` ポップオーバーをチェックボックス構成へ改修し、`TraceConnectorLayer` が `enabledKinds` を参照して描画を抑制。
- **P5-06 パネル単位表示**
  - `CardPanel` ツールバーへ `⛓️` トグルを実装し、アクティブファイルごとにコネクタ描画を ON/OFF。`tracePreferenceStore` に `fileVisibility` を持たせ、`TraceConnectorLayer` と接合点が同じ状態を共有する。
- **P5-07 トレース接合点機能**
  - カード左右の接合点をボタン化し、relation 数のバッジと個別ミュート操作を実現。`useTraceStore.aggregateCountsForFile` は「現在開かれているカードファイル集合」を引数に受け取り、オープン中ファイルに限定した件数を算出するため、タブのオープン/クローズに合わせてバッジが即時更新される。
  - `tracePreferenceStore.toggleCardVisibility` は `mutedCards` を更新し、`CardPanel`/`TraceConnectorLayer` がこのマップを購読しているため、接合点クリック時にバッジ・コネクタ可視状態が即座に反映される。
  - `connectorLayoutStore` ではアンカー登録時に「スクロールビューポート内に表示されているか」を判定して `isVisible` を保持し、`TraceConnectorLayer` はこのフラグが真のアンカー同士に限定して線を描画することで、スクロールアウトしたカードのコネクタを自動的に抑制する。
  - 新設した `showOffscreenConnectors` フラグ（🛰️ トグル）は `tracePreferenceStore` で管理し、ON の場合は `TraceConnectorLayer` が `isVisible` 判定をスキップしてビューポート外カード間のコネクタも描画する。
  - カードパネルツールバーの ⛓️ トグルは、対象ファイル内の全カードIDを取得して `toggleFileVisibility(fileName, cardIds)` を呼び出し、左右接合点の `mutedCards` 状態を一括で書き換える。これにより、UI 上でも各トレース接合点ボタンの状態が即時反映され、仕様どおり「トレース接合点のコネクタ表示の有無」を通じてファイル全体の表示を制御する。
  - `Card` モデルに `markdownPreviewEnabled` を追加し、カード単位で Markdown プレビューのON/OFFを保持する。`normalizeCardOrder` で既存ファイルを読み込む際もデフォルト値（true）を適用。
  - `renderer/utils/markdown.ts` に簡易Markdownレンダラを実装し、危険なHTMLをエスケープしたうえで `CardPanel` が `dangerouslySetInnerHTML` に渡す。ヘッダの `MD` ボタンと上部ツールバーの 🅼 トグルで `markdownPreviewEnabled` と `uiStore.markdownPreviewGlobalEnabled` を参照し、描画可否を決定する。

### 8.7 P6 フィーチャ実装サマリ
- **P6-01 全文/正規表現検索 UI**
  - `src/renderer/App.tsx` に検索フォームを実装。`searchScopeEntries` と `searchUseRegex` を状態管理し、`executeSearch` が `createSearchMatcher`/`buildSnippet`（`renderer/utils/search.ts`）を用いてアクティブタブ/開いているタブ/_input ディレクトリのカードを横断検索する。
  - サイドバーにはスコープセレクタ、正規表現トグル、検索/クリアボタン、状態メッセージ、結果リストを配置。結果の `SearchResultItem` をクリックすると `handleSearchResultNavigate` がタブを自動ロードし選択カードへフォーカスする。
  - `styles.css` の `.sidebar__search-*` / `.search-results*` でフォームとリストをテーマ対応デザインに統一。`searchStatusText` を `aria-live` 領域に載せてアクセシビリティを確保。
- **P6-02 カードパネルフィルタ**
  - `CardPanel.tsx` に `filterText` と `kindFilter` を実装し、`filteredCardIds`/`visibleCards` を介して部分一致＋種別条件を満たしたカードと祖先だけを描画。フィルタ有効時はツールバー右端に `カード総数（表示: n）` を表示する。
  - 種別フィルタは 📚 ボタンのポップオーバー（`panel-filter-popover`）でチェックボックスと「全選択/全解除」を提供。テキストフィルタ入力はアクティブ時に強調表示し、`styles.css` の新クラスで装飾した。
- **P6-03 Dirty カード強調**
  - `workspaceStore` で保持していた `dirtyCardIds` を `CardPanel` から参照し、対象カードへ `card--dirty` を付与。`styles.css` にアンバー系リングを追加して未保存カードを即時識別できるようにした。
- **P6-04 ログフィルタリング**
  - `App.tsx` に `logLevelFilter`/`logFilterKeyword`/`displayedLogs` を追加し、ヘッダーへレベルセレクタ・キーワード検索・カウンタ・クリアボタンをまとめた。フィルタ結果は即座に `pre` 内へ反映し、ゼロ件時は空メッセージを表示する。
  - `styles.css` の `.log-area__*` クラスを拡張してヘッダーを多段レイアウト化し、フォームスタイルを他セクションと揃えた。
- **P6-05 ショートカット/ヘルプオーバーレイ**
  - `App.tsx` に `SHORTCUT_GROUPS` を定義し、トップツールバー右端へ「❔」ボタンを追加。ボタンまたは `Esc` で開閉できるモーダルをレンダリングし、グローバルショートカット・カード挿入操作・コンテキストメニュー操作を二列レイアウトで提示する。
  - `styles.css` に `.help-overlay*` を定義し、バックドロップ/カード風リスト/クローズボタンの外観を統一。アクセシビリティ確保のため `aria-modal` とフォーカストラップを備えた。
