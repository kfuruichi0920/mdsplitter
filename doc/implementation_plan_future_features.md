# 将来機能の開発計画書

**バージョン**: 1.0
**作成日**: 2025-11-12
**対象**: doc/future_ui_mockups.md に記載された13の将来機能

---

## 目次

1. [概要](#概要)
2. [機能の依存関係分析](#機能の依存関係分析)
3. [実装規模の見積もり](#実装規模の見積もり)
4. [開発計画（4フェーズ構成）](#開発計画4フェーズ構成)
5. [並行実行の推奨構成](#並行実行の推奨構成)
6. [リスク管理](#リスク管理)
7. [成果物の定義](#成果物の定義)
8. [タイムライン](#タイムライン)
9. [技術的考慮事項](#技術的考慮事項)

---

## 概要

本ドキュメントは、mdsplitter プロジェクトの将来機能として `doc/future_ui_mockups.md` に記載された13の機能について、実装の優先順位、依存関係、並行実行可能性を整理し、段階的な開発計画を提示するものです。

### 対象機能一覧

1. プロジェクトファイル機能（.msp形式）
2. トレースのマトリクス編集機能 【Completed】
3. 影響分析ヒートマップ（将来拡張として本計画では扱わない） 【Deprecated】
4. ID自動付与と接頭語指定機能  【Completed】
5. 未トレースカード数表示  【Completed】
6. 右クリックコンテキストメニュー  【Completed】
7. 検索機能の改善（別ダイアログ化）
8. カード履歴管理機能  【Completed】
9. カード出力機能  【Completed】
10. 廃止ステータスの追加  【Deprecated】
11. カード統合機能  【Completed】
12. Markdown Table表記対応 【Completed】
13. LLM機能の拡張

### 開発の基本方針

- **段階的実装**: 4フェーズに分けて段階的に実装
- **依存関係の尊重**: 基盤機能を先に実装し、その上に高度な機能を構築
- **並行実行の最大化**: 独立した機能は並行して開発可能
- **リスク管理**: 大規模機能は MVP（最小実装版）を先行
- **品質保証**: 各フェーズでテストを実施

---

## 機能の依存関係分析

### 依存関係マップ

```
【基盤機能層】← 他の機能が依存する土台
├─ 4. ID自動付与 (cardIdフィールド追加)【Completed】
│   └─ 影響範囲: 2, 5, 7, 9, 11, 12
└─ 10. 廃止ステータス (CardStatus型拡張)【Deprecated】
    └─ 影響範囲: 1, 2, 5, 9

【トレース機能層】← トレースストア/API依存
├─ 2. マトリクス編集 (依存: 4, 10) 【Completed】
├─ 5. 未トレースカード数 (依存: 4)【Completed】
└─ 9. カード出力 (依存: 4, 10)  【Completed】

【UI改善層】← 比較的独立、基盤機能への軽微な依存
├─ 6. 右クリックメニュー (独立度: 高) 【Completed】
├─ 7. 検索機能改善 (依存: 4) 
└─ 12. Markdown Table (独立度: 高)【Completed】

【高度な機能層】← 複数機能に依存、大規模実装
├─ 1. プロジェクトファイル (依存: 10)
├─ 8. 履歴管理 (依存: 4, 大規模)  【Completed】
├─ 11. カード統合 (依存: 4, 2/5)【Completed】
└─ 13. LLM拡張 (依存: 4, 変換パイプライン)
```

### 依存関係の詳細

#### 4. ID自動付与（最重要基盤）

**理由**: 多くの機能がカードの一意識別のために `cardId` を参照

- **2. マトリクス編集**: カードIDでマトリクスの行/列を識別
- **5. 未トレースカード数**: IDベースでトレース状態を判定
- **7. 検索機能改善**: ID検索クエリに必要
- **8. 履歴管理**: 履歴ファイル名に cardId を使用
- **9. カード出力**: エクスポート時の識別子として使用
- **11. カード統合**: 統合元/先のIDトレース
- **13. LLM拡張**: LLM生成カードへのID自動付与

#### 10. 廃止ステータス（基盤）

**理由**: カードのライフサイクル管理の基礎

- **1. プロジェクトファイル**: トレース整合性チェックで廃止カード検出
- **2. マトリクス編集**: 廃止カードの視覚的区別
- **5. 未トレースカード数**: 廃止カードを除外したカウント
- **9. カード出力**: エクスポート時のフィルタオプション

#### 2. マトリクス編集（トレース機能の要）

**理由**: トレース一括編集機能を提供

- **9. カード出力**: マトリクス形式エクスポートに利用
- **11. カード統合**: トレース引き継ぎロジックを共有

---

## 実装規模の見積もり

| 機能ID | 機能名 | 規模 | 工数目安 | 主な実装範囲 | リスク |
|--------|--------|------|----------|-------------|-------|
| 10 | 廃止ステータスの追加 | 小 | 0.5-1日 | CardStatus型拡張、UI制約追加 | 低 |
| 4 | ID自動付与と接頭語指定 | 中 | 1-2日 | Card型拡張、ConversionModal拡張 | 中 |
| 6 | 右クリックコンテキストメニュー | 中 | 1-2日 | 新規コンポーネント、統計ダイアログ | 低 |
| 12 | Markdown Table表記対応 | 小 | 0.5-1日 | markdown.ts拡張 | 低 |
| 7 | 検索機能の改善 | 大 | 2-3日 | 新規ダイアログ、クエリビルダー | 中 |
| 5 | 未トレースカード数表示 | 小 | 0.5-1日 | ツールバー拡張、フィルタロジック | 低 |
| 2 | トレースマトリクス編集 | 大 | 3-4日 | 新規ダイアログ、2Dグリッド表示 | 高 |
| 9 | カード出力機能 | 大 | 2-3日 | エクスポートダイアログ、各形式対応 | 中 |
| 11 | カード統合機能 | 中 | 2-3日 | 統合ダイアログ、トレース引き継ぎ | 中 |
| 1 | プロジェクトファイル機能 | 大 | 3-4日 | .msp形式、プロジェクト管理ダイアログ | 高 |
| 8 | カード履歴管理機能 | 特大 | 5-6日 | 新ストア、履歴ファイル、差分表示 | 高 |
| 13 | LLM機能の拡張 | 大 | 3-4日 | llmAdapter実装、段落分割、要約 | 中 |

**合計工数**: 約23-30日（単独開発の場合）

### 規模の判定基準

- **小**: 既存コンポーネントの拡張のみ、新規ファイル1-2個
- **中**: 新規コンポーネント追加、複数ファイル変更
- **大**: 新規ダイアログ/ストア追加、広範な変更
- **特大**: 新規サブシステム追加、既存コード全体への影響

---

## 開発計画（4フェーズ構成）

### フェーズ1: 基盤機能の拡張（2-3日）

**目的**: 他機能の前提となるデータモデルとコア機能を整備

#### 1.1. 廃止ステータスの追加（0.5-1日）

**実装範囲**:
- `/src/shared/workspace.ts`
  - `CardStatus` 型に `'deprecated'` を追加
  ```typescript
  type CardStatus = 'draft' | 'review' | 'approved' | 'deprecated';
  ```

- `/src/renderer/components/CardPanel.tsx`
  - 廃止バッジ表示（グレーアウト、取り消し線）
  - トレース接合点の無効化（廃止カードはトレース作成不可）
  - ステータス変更時の警告ダイアログ
    - 既存トレースがある場合: 「トレースを削除してから廃止してください」
  - フィルタ機能に「廃止カードを表示」トグル追加

- `/src/renderer/store/workspaceStore.ts`
  - `updateCardStatus()` に廃止ステータスへの移行制約を追加

**テスト項目**:
- [ ] カードを廃止ステータスに変更できる
- [ ] 廃止カードがグレーアウト表示される
- [ ] 廃止カードはトレース接合点が非表示になる
- [ ] トレースがあるカードの廃止時に警告が表示される
- [ ] フィルタで廃止カードの表示/非表示を切り替えられる

---

#### 1.2. ID自動付与と接頭語指定（1-2日）

**実装範囲**:
- `/src/shared/workspace.ts`
  - `Card` 型に `cardId?: string` フィールドを追加
  ```typescript
  interface Card {
    // 既存フィールド
    id: string;  // 内部UUID
    // 新規フィールド
    cardId?: string;  // ユーザー向け識別子（例: REQ-001）
    // ...
  }
  ```

- `/src/renderer/components/ConversionModal.tsx`
  - ID設定セクションを追加
    - 接頭語入力（例: REQ, SPEC, TEST）
    - 開始番号（デフォルト: 1）
    - 桁数（デフォルト: 3、ゼロパディング）
    - 付与ルール選択
      - すべてのカードに付与
      - 見出しカードのみ
      - 手動指定のみ

- `/src/shared/conversion/pipeline.ts`
  - ID自動生成ロジック追加
  ```typescript
  function generateCardId(prefix: string, number: number, digits: number): string {
    return `${prefix}-${String(number).padStart(digits, '0')}`;
  }
  ```

- `/src/renderer/components/CardPanel.tsx`
  - カードID表示エリア追加（タイトル上部）
  - カードID編集機能（ダブルクリックで編集可能）
  - 重複チェック機能

**テスト項目**:
- [ ] 変換時に指定した接頭語でIDが生成される
- [ ] 開始番号と桁数が反映される
- [ ] カードIDが重複しない
- [ ] カードIDを手動編集できる
- [ ] カードIDでソート/検索できる

---

### フェーズ2: UI改善機能（2-4日）

**目的**: ユーザビリティを向上させる比較的独立した機能を実装

#### 並行実行グループA（独立度: 高）

##### 2A-1. 右クリックコンテキストメニュー（1-2日）

**実装範囲**:
- `/src/renderer/components/ContextMenu.tsx` （新規作成）
  - メニュー項目
    - カード操作: 編集、コピー、貼り付け、削除
    - カード追加: 前に追加、後に追加、子として追加
    - 表示: 統計情報、履歴表示（フェーズ4で実装）
  - 位置計算ロジック（画面外に出ない調整）

- `/src/renderer/components/CardStatsDialog.tsx` （新規作成）
  - 統計情報表示
    - 文字数、単語数
    - 作成日時、更新日時
    - トレース接続数（左/右）
    - 子カード数、階層レベル

- `/src/renderer/components/CardPanel.tsx`
  - `onContextMenu` イベントハンドラ追加
  - 右クリックメニューの表示制御

**テスト項目**:
- [ ] カードを右クリックでメニューが表示される
- [ ] メニュー項目の各操作が正常に動作する
- [ ] 統計情報ダイアログが正しい値を表示する
- [ ] メニューが画面外に出ない

---

##### 2A-2. Markdown Table表記対応（0.5-1日）

**実装範囲**:
- `/src/renderer/utils/markdown.ts`
  - テーブルパース関数追加
  ```typescript
  function parseMarkdownTable(markdown: string): TableData | null {
    // GitHub Flavored Markdown テーブル形式をパース
    // | Header1 | Header2 |
    // |---------|---------|
    // | Cell1   | Cell2   |
  }
  ```
  - テーブルレンダリング関数追加（HTMLテーブル生成）

- `/src/renderer/components/SettingsModal.tsx`
  - Markdownプレビュー設定セクションに「テーブル表示」トグル追加

- `/src/renderer/components/CardPanel.tsx`
  - カード本文にテーブルが含まれる場合、プレビューとして表示
  - テーブルスタイル（Tailwind CSS）

**テスト項目**:
- [ ] Markdownテーブル形式が正しくパースされる
- [ ] テーブルがHTMLとして正しくレンダリングされる
- [ ] 設定でテーブル表示をON/OFFできる
- [ ] テーブルのスタイルが適用される

---

#### 並行実行グループB（軽微な依存）

##### 2B-1. 検索機能の改善（2-3日）
この検索機能は、本体機能に対して、REST APIを介して、情報をやり取りできるように実装してください。

- `/src/renderer/components/SearchDialog.tsx` （新規作成）
  - モーダレスダイアログ（Ctrl+F で開く）
  - 検索クエリ種別
    - 通常テキスト検索、正規表現検索
    - ID検索
    - トレース元/先検索 (開いているカードファイルに対する再帰的検索、深さ指定(default=1))
    - 高度な検索（クエリビルダー）
  - 検索結果リスト
    - カードプレビュー
    - テキスト検索の場合はマッチ箇所のハイライト
	- IDカード検索の場合は、カード枠ハイライト
	- 検索結果は、矢印キーでナビゲーション（カード選択を移動させることで検索結果のカードを表示)
    - 検索結果は、クリックでカードにジャンプ
    - "検索結果のリスト"の複数管理、タブで過去の"検索結果のリスト"に切り替えられる。

- `/src/renderer/components/AdvancedSearchBuilder.tsx` （新規作成）
  - クエリビルダーUI
   - 通常検索
    - 条件追加（AND/OR）
    - フィールド選択（タイトル、本文、カードID、ステータス、種別）
    - 演算子選択（含む、一致、正規表現）
   - 高度検索
    - トレース元／先検索　（深さ指定）

- `/src/renderer/utils/search.ts`
  - 既存の `searchCards()` を拡張
  - クエリパーサー追加
  - 正規表現サポート

- `/src/renderer/store/uiStore.ts`
  - 検索ダイアログの開閉状態管理

**テスト項目**:
- [ ] Ctrl+F で検索ダイアログが開く
- [ ] 各検索クエリ種別が正常に動作する
- [ ] 検索結果リストが正しく表示される
- [ ] 検索結果をクリックでカードにジャンプする
- [ ] 高度な検索の条件が正しく評価される

---

##### 2B-2. 未トレースカード数表示（0.5-1日）

**依存**: cardId（フェーズ1で実装）

**実装範囲**:
- `/src/renderer/components/CardPanel.tsx`
  - ツールバーに統計情報表示エリアを追加
    - 総カード数
    - 未トレースカード数（左/右）
    - フィルタ適用後のカード数
  - 未トレースカウント関数追加
  ```typescript
  function countUntracedCards(
    cards: Card[],
    side: 'left' | 'right'
  ): number {
    return cards.filter(card => {
      const hasTrace = side === 'left' ? card.hasLeftTrace : card.hasRightTrace;
      return !hasTrace && card.status !== 'deprecated';
    }).length;
  }
  ```
  - 未トレースカード数をクリックで「未トレースのみ表示」フィルタ適用

- `/src/renderer/store/workspaceStore.ts`
  - フィルタ条件に「未トレースのみ」を追加

**テスト項目**:
- [ ] ツールバーに統計情報が表示される
- [ ] 未トレースカード数が正確にカウントされる
- [ ] 廃止カードは未トレースカウントから除外される
- [ ] 未トレースカード数をクリックでフィルタが適用される

---

### フェーズ3: トレース関連機能（5-7日）

**目的**: トレーサビリティ機能を強化

#### 3.1. トレースのマトリクス編集（3-4日）

**依存**: cardId, deprecated status（フェーズ1で実装）

**実装範囲**:
- `/src/renderer/components/TraceMatrixDialog.tsx` （新規作成）
  - モーダレスダイアログ。同時に複数起動可能。
  - 画面上部には情報サマリ（左ファイルのカード、右ファイルのカード）。ツールバー（フィルタ機能等、エクスポート機能等）
  - 画面フッタに統計情報
  - 2Dグリッドビュー
    - 行: 左ファイルのカード
    - 列: 右ファイルのカード
    - セル: トレース関係の有無
	- 行/列のヘッダ: カードID, タイトル、ステータス。ヘッダは常に表示し、セルは水平／垂直でスクロール。
	- 行幅／列幅はなるべくコンパクトにし、全体を俯瞰しながら操作ができるようにしたい。
  - セル操作
    - クリック: トレース作成/削除
    - 右クリック: トレース種別選択（refines, tests, satisfy, etc.）
    - ホバー: カードプレビュー表示
　- カード一覧表示側との表示連動
    - マトリクスダイアログ→カード一覧表示：セル操作のカード表示／コネクタへのリアルタイム反映
      - クリック操作によるトレース／作成による、カードコネクタ数、コネクタ描画の更新
	  - 右クリック操作によるトレース種別選択による、コネクタ描画の更新
    - カード一覧表示→マトリクスダイアログ：カード選択、コネクタ更新の、行／列ハイライトとセルへのリアルタイム反映
      - カード一覧で選択中のカードに対応する、行／列をハイライト。カード選択が変わったらマトリクス表示も連動する。
	  - カード一覧側でのコネクタ作成／削除／変更を、マトリクス表示に反映する
  - フィルタ機能
    - カードID、タイトル、ステータス
    - ある列に対しトレースがある行のみを表示、ある行に対しトレースがある列のみを表示。簡単にフィルタを切り替え可能とする。
	- 列/行へのフィルタは AND条件、OR条件を組み合わせ自由にフィルタ操作できる。
	- 全列／全列のフィルタ解除を操作できる。
  - ハイライト機能
    - 選択カードの行/列をハイライト
	- トレースあるセルをハイライト
  - 統計情報
    - トレース総数、未トレースカード数
  - エクスポート
    - CSV、Excel形式でマトリクスエクスポート

- `/src/renderer/components/TraceMatrixCell.tsx` （新規作成）
  - セルコンポーネント
  - トレース種別に応じたセル色

- `/src/renderer/store/traceStore.ts`
  - マトリクスデータの取得関数追加
  ```typescript
  function getTraceMatrix(
    leftFile: string,
    rightFile: string
  ): TraceMatrix {
    // 既存のトレースキャッシュを利用
  }
  ```

- `/src/renderer/store/workspaceStore.ts`
  - マトリクス編集からのトレース更新関数追加

**テスト項目**:
- [ ] マトリクスダイアログが正しく表示される
- [ ] セルクリックでトレースが作成/削除される
- [ ] 右クリックでトレース種別を変更できる
- [ ] フィルタが正常に動作する
- [ ] ハイライト機能が動作する
- [ ] 統計情報が正しく表示される
- [ ] CSV/Excelエクスポートが動作する

---

#### 3.2. カード出力機能（2-3日）

**依存**: cardId, deprecated status, マトリクス編集の成果物（フェーズ1, 3.1で実装）

**実装範囲**:
- `/src/renderer/components/ExportDialog.tsx` （新規作成）
  - モーダルダイアログ
  - エクスポート形式選択
    1. カード一覧（CSV）
    2. トレースマトリクス（CSV/Excel）【マトリクス画面の実現済みのため対象外とする】
    3. 影響範囲分析（CSV）
    4. セマンティックWeb（RDF/JSON-LD）
    5. Markdown形式
  - フィルタオプション
    - 廃止カードを含む/含まない
    - ステータス選択
    - カード種別選択
  - 出力先選択ダイアログ

- `/src/main/export.ts` （新規作成）
  - エクスポート処理（各形式）
  - CSVライター
  ```typescript
  function exportCardsToCSV(cards: Card[], filePath: string): void {
    // カードID, タイトル, 本文, ステータス, 種別, ...
  }
  ```
  - Excelライター（外部ライブラリ: `xlsx`）
  - RDF/JSON-LDシリアライザ
  - Markdownライター（元の形式に復元）

- `/src/main/main.ts`
  - IPC APIハンドラ追加
  ```typescript
  ipcMain.handle('export-cards', async (event, format, options, filePath) => {
    // エクスポート処理を呼び出し
  });
  ```

- `/src/main/preload.ts`
  - エクスポートAPI公開
  ```typescript
  export: {
    exportCards: (format, options, filePath) => ipcRenderer.invoke('export-cards', ...)
  }
  ```

**テスト項目**:
- [ ] 各エクスポート形式で正しく出力される
- [ ] フィルタオプションが反映される
- [ ] 出力先を選択できる
- [ ] エクスポート後に成功通知が表示される
- [ ] エラー時にエラーメッセージが表示される

---

### フェーズ4: 高度な機能（13-17日）

**目的**: 複数機能を統合した高度な機能を実装

#### 4.1. カード統合機能（2-3日）

**依存**: cardId, トレース操作（フェーズ1, 3で実装）

**実装範囲**:
- `/src/renderer/components/CardMergeDialog.tsx` （新規作成）
  - モーダルダイアログ
  - 統合対象カード選択（複数選択）
  - 連続性検証
    - 兄弟カードのみ統合可能
    - 親が同じカードのみ
  - 統合後カード情報編集
    - タイトル、本文、ステータス、種別
  - 統合オプション
    - トレース情報の引き継ぎ（左右それぞれ選択）
    - 階層構造の維持
  - プレビュー機能

- `/src/renderer/store/workspaceStore.ts`
  - カード統合関数追加
  ```typescript
  function mergeCards(
    cardIds: string[],
    options: MergeOptions
  ): Card {
    // 統合ロジック
    // 1. 連続性検証
    // 2. 新規カード生成
    // 3. トレース情報引き継ぎ
    // 4. 元カードの削除
    // 5. 履歴記録
  }
  ```

- トレース引き継ぎロジック
  - 左トレース: すべての元カードの左トレースを新規カードに引き継ぎ
  - 右トレース: すべての元カードの右トレースを新規カードに引き継ぎ
  - 重複削除

- Undo/Redo対応
  - 統合操作全体を1つのアクションとして記録

**テスト項目**:
- [ ] 複数カードを選択して統合できる
- [ ] 連続性検証が正しく動作する
- [ ] トレース情報が正しく引き継がれる
- [ ] 統合後のカード情報が正しい
- [ ] Undo/Redoが正常に動作する

---

#### 4.2. プロジェクトファイル機能（3-4日）

**依存**: deprecated status（フェーズ1で実装）

**実装範囲**:
- `/src/shared/project.ts` （新規作成）
  - `.msp` 形式の型定義
  ```typescript
  interface ProjectFile {
    version: string;
    metadata: {
      name: string;
      description: string;
      createdAt: string;
      updatedAt: string;
    };
    files: {
      cardFiles: string[];  // カードファイルの相対パス
      traceFiles: string[];  // トレースファイルの相対パス
    };
    settings?: {
      theme?: ThemeSettings;
      // プロジェクト固有の設定
    };
  }
  ```

- `/src/renderer/components/ProjectManagementDialog.tsx` （新規作成）
  - プロジェクト作成ダイアログ
    - プロジェクト名、説明
    - カードファイル選択（複数）
    - トレースファイル自動検出
  - プロジェクト読込ダイアログ
    - .msp ファイル選択
    - ファイル一覧表示
    - トレース整合性チェック結果表示
  - プロジェクト保存
    - 現在のワークスペースを .msp として保存

- `/src/main/project.ts` （新規作成）
  - プロジェクトファイルの読込/保存
  - トレース整合性チェック
  ```typescript
  function validateTraceConsistency(project: ProjectFile): ValidationResult {
    // 1. 廃止カードがトレースの始点/終点になっていないか
    // 2. トレースファイルの left_file/right_file が存在するか
    // 3. トレースのカードIDが存在するか
  }
  ```

- `/src/main/main.ts`
  - IPC APIハンドラ追加
  ```typescript
  ipcMain.handle('load-project', async (event, filePath) => { ... });
  ipcMain.handle('save-project', async (event, project, filePath) => { ... });
  ```

- `/src/renderer/store/workspaceStore.ts`
  - プロジェクト読込時のワークスペース復元ロジック

**テスト項目**:
- [ ] プロジェクトを作成できる
- [ ] プロジェクトを保存できる
- [ ] プロジェクトを読み込める
- [ ] トレース整合性チェックが正常に動作する
- [ ] 整合性エラーが正しく表示される

---

#### 4.3. カード履歴管理機能（5-6日）⚠️最大規模

**依存**: cardId（フェーズ1で実装）

**実装範囲**:
- `/src/shared/history.ts` （新規作成）
  - 履歴データ型定義
  ```typescript
  interface CardHistory {
    cardId: string;
    fileName: string;
    versions: CardVersion[];
  }

  interface CardVersion {
    versionId: string;  // UUID
    timestamp: string;
    operation: 'create' | 'update' | 'delete' | 'merge' | 'split';
    card: Card;  // その時点のカードスナップショット
    diff?: {
      before: Partial<Card>;
      after: Partial<Card>;
    };
  }
  ```

- `/src/renderer/store/historyStore.ts` （新規作成）
  - Zustandストア
  - 履歴の取得、追加、削除
  - 履歴ファイルの読込/保存

- 履歴ファイル形式
  - ファイルパス: `_history/<cardfile>_<cardid>_history.json`
  - 1カードあたり1履歴ファイル
  - 最大バージョン数: 100（設定可能）

- `/src/renderer/components/CardHistoryDialog.tsx` （新規作成）
  - モーダルダイアログ
  - バージョンリスト
    - タイムスタンプ、操作種別
    - ユーザー（将来拡張）
  - 差分表示
    - Before/After 比較
    - 変更箇所のハイライト
  - バージョン操作
    - 復元: 選択バージョンの内容を現在のカードに復元
    - エクスポート: バージョンを個別にエクスポート
    - 削除: バージョンを削除

- `/src/renderer/components/CardDiffViewer.tsx` （新規作成）
  - 差分表示コンポーネント
  - テキスト差分ライブラリ: `diff` または `react-diff-viewer`

- `/src/renderer/store/workspaceStore.ts`
  - カード保存時に、すべての変更したカードのカード操作に履歴記録フックを追加
  ```typescript
  // カード更新時
  updateCard(cardId, updates) {
    // 既存の更新処理
    // ...
    // 履歴記録
    historyStore.getState().addVersion(cardId, 'update', oldCard, newCard);
  }
  ```

- `/src/main/history.ts` （新規作成）
  - 履歴ファイルの読込/保存
  - 古い履歴の自動削除（最大数を超えた場合）

- `/src/main/main.ts`
  - IPC APIハンドラ追加
  ```typescript
  ipcMain.handle('load-history', async (event, cardId, fileName) => { ... });
  ipcMain.handle('save-history', async (event, history) => { ... });
  ```

**テスト項目**:
- [ ] カード保存時に、変更したカードのカード操作に履歴が記録される
- [ ] 履歴ダイアログでバージョンリストが表示される
- [ ] 差分表示が正しく動作する
- [ ] バージョンを復元できる
- [ ] バージョンをエクスポートできる
- [ ] 古い履歴が自動削除される

---

#### 4.4. LLM機能の拡張（3-4日）

**依存**: cardId, 変換パイプライン（フェーズ1で実装、既存）

**実装範囲**:
- `/src/shared/conversion/llmAdapter.ts`
  - 既存のプレースホルダ実装を完成
  - LLMプロバイダー対応
    - OpenAI GPT-4
    - Anthropic Claude
    - Azure OpenAI
  - API実装
    1. **段落分割判別API**
    ```typescript
    async function shouldSplitParagraph(
      paragraph: string,
      context: ConversionContext
    ): Promise<boolean> {
      // LLMに問い合わせ
      // プロンプト: 「この段落を複数のカードに分割すべきか？」
    }
    ```
    2. **段落分割提案API**
    ```typescript
    async function suggestParagraphSplit(
      paragraph: string
    ): Promise<string[]> {
      // LLMに分割位置を提案させる
    }
    ```
    3. **グラフRAG要約生成API**
    ```typescript
    async function generateGraphSummary(
      cards: Card[],
      traces: TraceabilityLink[]
    ): Promise<string> {
      // カードとトレースをグラフとして解釈し、要約を生成
    }
    ```

- `/src/shared/workspace.ts`
  - `Card` 型に `summary?: string` フィールド追加

- `/src/renderer/components/ConversionModal.tsx`
  - LLMオプションセクション拡張
    - 段落分割判別を有効化
    - 要約生成を有効化
    - プロンプトカスタマイズ

- `/src/renderer/components/SettingsModal.tsx`
  - LLM設定拡張
    - API Key入力（プロバイダー別）
    - モデル選択
    - タイムアウト設定
    - リトライ設定

- `/src/renderer/components/CardPanel.tsx`
  - カードに要約が存在する場合、要約表示エリアを追加

- リトライ処理
  - レート制限対応（Exponential Backoff）
  - エラーハンドリング

**テスト項目**:
- [ ] 各LLMプロバイダーに接続できる
- [ ] 段落分割判別が動作する
- [ ] 段落分割提案が動作する
- [ ] グラフRAG要約が生成される
- [ ] レート制限時にリトライする
- [ ] エラー時に適切なメッセージが表示される

---

## 並行実行の推奨構成

### 複数人での開発

#### チーム構成案（3チーム体制）

| チーム | 担当フェーズ | 主な役割 | 開発期間 |
|--------|-------------|---------|---------|
| **チームA（バックエンド）** | フェーズ1 → フェーズ4 | データモデル、ストア、IPC API | 週1-7 |
| **チームB（フロントエンド）** | フェーズ2-A → フェーズ3 | UI コンポーネント、ダイアログ | 週2-4 |
| **チームC（フロントエンド）** | フェーズ2-B → フェーズ4 | 検索、履歴、LLM UI | 週2-7 |

#### 並行実行タイムライン

```
週   チームA           チームB           チームC
1    [フェーズ1]       (待機)           (待機)
2    [フェーズ1完了]   [フェーズ2-A]    [フェーズ2-B]
3    [フェーズ4開始]   [フェーズ2-A完了] [フェーズ2-B完了]
4    [フェーズ4継続]   [フェーズ3]       [待機/テスト]
5    [フェーズ4継続]   [フェーズ3完了]   [フェーズ4参加]
6    [フェーズ4継続]   (統合テスト)      [フェーズ4継続]
7    [フェーズ4完了]   (統合テスト)      [フェーズ4完了]
```

### 単独開発

#### 推奨順序

```
週1: フェーズ1
  - Day 1-2: 10. 廃止ステータス
  - Day 3-5: 4. ID自動付与

週2: フェーズ2-A
  - Day 1-2: 6. 右クリックメニュー
  - Day 3: 12. Markdown Table

週3: フェーズ2-B
  - Day 1-3: 7. 検索機能改善
  - Day 4: 5. 未トレースカード数

週4: フェーズ3前半
  - Day 1-4: 2. マトリクス編集

週5: フェーズ3後半 + フェーズ4開始
  - Day 1-3: 9. カード出力
  - Day 4-5: 11. カード統合（開始）

週6: フェーズ4継続
  - Day 1-2: 11. カード統合（完了）
  - Day 3-5: 1. プロジェクトファイル

週7: フェーズ4継続
  - Day 1-5: 8. 履歴管理

週8: フェーズ4完了
  - Day 1-4: 13. LLM拡張
  - Day 5: 統合テスト、ドキュメント整備
```

---

## リスク管理

### 高リスク機能

| 機能 | リスク内容 | リスクレベル | 対策 |
|------|-----------|-------------|------|
| **8. 履歴管理** | 最大規模の実装、既存コード全体への広範な変更が必要 | **高** | MVP版を先行実装（差分表示なし、基本的な履歴記録のみ） |
| **13. LLM拡張** | 外部API依存、レート制限、コスト問題 | **高** | モック実装で先行開発、リトライ処理の実装、コスト見積もり |
| **2. マトリクス編集** | 大量データ時のパフォーマンス問題 | **中** | 仮想スクロール導入、ページング検討、フィルタ機能強化 |
| **1. プロジェクトファイル** | ファイル構造の整合性、バージョン互換性 | **中** | バリデーション強化、バックアップ機能、マイグレーション戦略 |
| **7. 検索機能改善** | 検索パフォーマンス、正規表現のエラー処理 | **低** | インデックス検討、入力バリデーション |

### MVP版の定義（高リスク機能）

#### 8. 履歴管理（MVP版）

**含める機能**:
- カード更新時の履歴記録（create, update, delete）
- 履歴ファイルの保存/読込
- 履歴ダイアログでのバージョンリスト表示
- バージョン復元機能

**含めない機能（後回し）**:
- 差分表示（Before/After比較）
- バージョンのエクスポート
- 高度なフィルタリング

#### 13. LLM拡張（MVP版）

**含める機能**:
- OpenAI GPT-4 への接続
- 段落分割判別API（基本プロンプト）
- エラーハンドリング、リトライ処理

**含めない機能（後回し）**:
- 他のLLMプロバイダー対応（Claude, Azure）
- グラフRAG要約生成
- プロンプトカスタマイズ

---

## 成果物の定義

### フェーズ1完了時の成果物

**コード**:
- [ ] `/src/shared/workspace.ts`: `CardStatus` に `'deprecated'` 追加、`Card` に `cardId` 追加
- [ ] `/src/renderer/components/CardPanel.tsx`: 廃止バッジ表示、カードID表示
- [ ] `/src/renderer/components/ConversionModal.tsx`: ID設定UI追加
- [ ] `/src/shared/conversion/pipeline.ts`: ID自動生成ロジック

**ドキュメント**:
- [ ] フェーズ1機能の操作マニュアル

**テスト**:
- [ ] 単体テスト: Card型バリデーション
- [ ] E2Eテスト: カード作成/編集フロー

---

### フェーズ2完了時の成果物

**コード**:
- [ ] `/src/renderer/components/ContextMenu.tsx`: 右クリックメニュー
- [ ] `/src/renderer/components/CardStatsDialog.tsx`: 統計情報ダイアログ
- [ ] `/src/renderer/utils/markdown.ts`: テーブルパース&レンダリング
- [ ] `/src/renderer/components/SearchDialog.tsx`: 検索ダイアログ
- [ ] `/src/renderer/components/AdvancedSearchBuilder.tsx`: クエリビルダー
- [ ] `/src/renderer/components/CardPanel.tsx`: 未トレースカード数表示

**ドキュメント**:
- [ ] フェーズ2機能の操作マニュアル

**テスト**:
- [ ] E2Eテスト: UI操作フロー（右クリック、検索、フィルタ）

---

### フェーズ3完了時の成果物

**コード**:
- [ ] `/src/renderer/components/TraceMatrixDialog.tsx`: マトリクス編集ダイアログ
- [ ] `/src/renderer/components/TraceMatrixCell.tsx`: セルコンポーネント
- [ ] `/src/renderer/components/ExportDialog.tsx`: エクスポートダイアログ
- [ ] `/src/main/export.ts`: 各形式のエクスポート処理
- [ ] IPC API: `export-cards`

**ドキュメント**:
- [ ] トレース機能の操作マニュアル
- [ ] エクスポート形式仕様書

**テスト**:
- [ ] 統合テスト: トレース整合性チェック
- [ ] E2Eテスト: マトリクス編集フロー

---

### フェーズ4完了時の成果物

**コード**:
- [x] `/src/renderer/components/CardMergeDialog.tsx`: カード統合ダイアログ
- [ ] `/src/shared/project.ts`: プロジェクトファイル型定義
- [ ] `/src/renderer/components/ProjectManagementDialog.tsx`: プロジェクト管理ダイアログ
- [ ] `/src/main/project.ts`: プロジェクトファイル処理
- [ ] `/src/shared/history.ts`: 履歴データ型定義
- [ ] `/src/renderer/store/historyStore.ts`: 履歴ストア
- [ ] `/src/renderer/components/CardHistoryDialog.tsx`: 履歴ダイアログ
- [ ] `/src/renderer/components/CardDiffViewer.tsx`: 差分表示コンポーネント
- [ ] `/src/shared/conversion/llmAdapter.ts`: LLMアダプター完成版
- [ ] IPC API: `load-project`, `save-project`, `load-history`, `save-history`

**ドキュメント**:
- [ ] 全機能の操作マニュアル
- [ ] プロジェクトファイル仕様書（.msp形式）
- [ ] 履歴管理仕様書
- [ ] LLM機能仕様書

**テスト**:
- [ ] 負荷テスト: 大規模データでのパフォーマンス検証
- [ ] 統合テスト: 全機能の相互連携
- [ ] E2Eテスト: エンドツーエンドの業務フロー

---

## タイムライン

### ガントチャート（単独開発）

```
フェーズ  | 週1 | 週2 | 週3 | 週4 | 週5 | 週6 | 週7 | 週8 |
---------|-----|-----|-----|-----|-----|-----|-----|-----|
フェーズ1 | ███ |     |     |     |     |     |     |     |
フェーズ2 |     | ███ | ███ |     |     |     |     |     |
フェーズ3 |     |     |     | ███ | ███ |     |     |     |
フェーズ4 |     |     |     |     | ██  | ███ | ███ | ███ |
テスト   |     |     |  █  |  █  |  █  |  █  |  █  | ██  |
```

### マイルストーン

| 日付 | マイルストーン | 内容 |
|------|--------------|------|
| Week 1 | フェーズ1完了 | 基盤機能（廃止ステータス、ID自動付与）完成 |
| Week 3 | フェーズ2完了 | UI改善機能（右クリック、検索、Table対応）完成 |
| Week 5 | フェーズ3完了 | トレース機能（マトリクス編集、出力）完成 |
| Week 8 | フェーズ4完了 | 高度な機能（統合、プロジェクト、履歴、LLM）完成 |
| Week 8 | リリース | 全機能の統合テスト完了、リリース準備完了 |

---

## 技術的考慮事項

### パフォーマンス最適化

#### 2. マトリクス編集

**課題**: 大量カード時のマトリクス表示パフォーマンス

**対策**:
- 仮想スクロール導入（`react-window` または `react-virtualized`）
- セルの遅延レンダリング
- フィルタリング強化（表示カード数を削減）
- ページング検討（1ページ100行×100列まで）

#### 8. 履歴管理

**課題**: 履歴ファイルの肥大化

**対策**:
- 最大バージョン数の制限（デフォルト: 100）
- 古い履歴の自動アーカイブ
- 差分圧縮（全スナップショットではなく差分のみ保存を検討）

#### 13. LLM機能

**課題**: API呼び出しの遅延、コスト

**対策**:
- キャッシュ機構（同じ段落への問い合わせを避ける）
- バッチ処理（複数段落をまとめて処理）
- プログレスバー表示（ユーザーへのフィードバック）

---

### セキュリティ考慮事項

#### LLM API Key管理

- API Keyは平文保存しない
- Electronの`safeStorage` APIを使用して暗号化
- 設定ファイルには暗号化済みの値を保存

```typescript
import { safeStorage } from 'electron';

// 保存時
const encrypted = safeStorage.encryptString(apiKey);
settings.llm.apiKeyEncrypted = encrypted.toString('base64');

// 読込時
const buffer = Buffer.from(settings.llm.apiKeyEncrypted, 'base64');
const apiKey = safeStorage.decryptString(buffer);
```

#### プロジェクトファイルの検証

- .msp ファイル読込時にスキーマ検証
- パスインジェクション対策（相対パスのみ許可）
- ファイルサイズ制限

---

### 依存ライブラリの追加

| ライブラリ | 用途 | ライセンス | インストールコマンド |
|-----------|------|-----------|-------------------|
| `xlsx` | Excelエクスポート | Apache-2.0 | `npm install xlsx` |
| `diff` | テキスト差分計算 | BSD-3-Clause | `npm install diff` |
| `react-diff-viewer` | 差分表示UI | MIT | `npm install react-diff-viewer` |
| `react-window` | 仮想スクロール | MIT | `npm install react-window` |
| `jsonld` | JSON-LD処理 | BSD-3-Clause | `npm install jsonld` |

---

### テスト戦略

#### 単体テスト（Jest）

**対象**:
- データモデル（Card, TraceabilityLink, ProjectFile, CardHistory）
- ユーティリティ関数（search, markdown, traceLayout）
- ストアのロジック（workspaceStore, traceStore, historyStore）

**カバレッジ目標**: 80%以上

#### 統合テスト（Jest）

**対象**:
- IPC通信（main ↔ renderer）
- ファイル読込/保存
- トレース整合性チェック

#### E2Eテスト（Playwright）

**対象**:
- カード作成/編集/削除フロー
- トレース作成/削除フロー
- マトリクス編集フロー
- 検索機能フロー
- プロジェクト管理フロー
- エクスポート機能フロー

**重点テストシナリオ**:
1. 新規プロジェクト作成 → カード追加 → トレース作成 → 保存 → 読込
2. 検索 → カード編集 → 履歴確認 → 復元
3. マトリクス編集 → エクスポート → CSV確認

---

## まとめ

本開発計画により、13の将来機能を **約8週間（単独開発）** または **約4-5週間（3チーム並行開発）** で実装することが可能です。

### 成功のポイント

1. **フェーズ1を確実に完了**: 基盤機能が後続フェーズの前提
2. **並行実行の活用**: 独立した機能は並行して開発
3. **MVP版の先行実装**: 高リスク機能はまず基本機能のみ実装
4. **継続的なテスト**: 各フェーズでテストを実施し、品質を担保
5. **ドキュメントの整備**: 実装と並行してドキュメントを作成

### 次のステップ

1. **チーム構成の決定**: 単独開発 or 複数人開発
2. **開発環境の準備**: 依存ライブラリのインストール、ブランチ戦略
3. **フェーズ1の着手**: 廃止ステータス → ID自動付与の順に実装開始
4. **週次レビュー**: 進捗確認、問題点の早期発見

---

**承認者**: __________________
**承認日**: __________________
