# mdsplitter API化構想 - 検討レポート

作成日: 2025-11-16
作成者: Claude (Anthropic)

---

## 1. エグゼクティブサマリ

本レポートは、mdsplitterをAPI経由で利用可能にするための機能検討、実現方法、必要な技術スタック、および実装順序を提案するものです。

**主な提案:**
- 段階的なAPI化アプローチ（フェーズ1〜4）
- 3つの実装方式（HTTP REST API、GraphQL、MCP）の併用
- トレーサビリティ情報を活用したLLM連携機能の強化
- クライアント・サーバ分離によるローカル検索機能の実現

---

## 2. 本ツールの機能概要

### 2.1 mdsplitterとは

mdsplitterは、自然言語文書（`.txt`、`.md`）を「カード」単位に構造化し、階層・トレーサビリティを含む編集を可能にするElectron/React/TypeScript製デスクトップアプリケーションです。

### 2.2 主要機能

1. **カード変換機能**
   - テキスト文書を構造化されたカード形式に変換
   - 固定ルールまたはLLMによる変換
   - カード種別: 見出し、段落、箇条書き、図、表、試験、QA

2. **カード編集機能**
   - カードのCRUD操作
   - 階層構造の管理（親子関係）
   - 順序関係の管理（兄弟関係）
   - Undo/Redo機能

3. **トレーサビリティ管理機能**
   - カード間の有向グラフ構造による関係性管理
   - 関係種別: trace（追跡）、refines（詳細化）、tests（テスト）、duplicates（重複）、satisfy（満足）、relate（関連）、specialize（特化）
   - カードファイル間のトレーサビリティも管理
   - トレースマトリクス表示・編集

4. **検索・分析機能**
   - 全文検索、正規表現検索
   - カード種別・ステータスによるフィルタリング
   - トレーサビリティ経路の探索

5. **履歴管理機能**
   - カード編集履歴の記録・復元
   - バージョン間差分表示

### 2.3 データモデル

**カードファイル (JSON形式):**
```json
{
  "schemaVersion": 1,
  "header": {
    "id": "uuid",
    "fileName": "example.json",
    "orgInputFilePath": "/path/to/original.txt",
    "inputFilePath": "/path/to/_input/copy.txt",
    "createdAt": "2025-11-16T10:00:00.000Z",
    "updatedAt": "2025-11-16T10:00:00.000Z",
    "memo": ""
  },
  "body": [
    {
      "id": "card-001",
      "type": "heading",
      "status": "approved",
      "content": {
        "text": "プロジェクト概要",
        "number": null
      },
      "updatedAt": "2025-11-16T10:00:00.000Z",
      "parent_id": null,
      "child_ids": ["card-002"],
      "prev_id": null,
      "next_id": null
    }
  ]
}
```

**トレーサビリティファイル (JSON形式):**
```json
{
  "schemaVersion": 1,
  "header": {
    "id": "uuid",
    "fileName": "trace_requirements_design.json",
    "leftFilePath": "/path/to/_out/requirements.json",
    "rightFilePath": "/path/to/_out/design.json",
    "createdAt": "2025-11-16T10:00:00.000Z",
    "updatedAt": "2025-11-16T10:00:00.000Z"
  },
  "left_file": "requirements.json",
  "right_file": "design.json",
  "relations": [
    {
      "id": "relation-001",
      "left_ids": ["card-001", "card-002"],
      "right_ids": ["card-101", "card-102"],
      "type": "trace",
      "directed": "left_to_right",
      "memo": "要求から設計へのトレース"
    }
  ]
}
```

---

## 3. API化の目的と構想

### 3.1 API化の背景と目的

1. **トレーサビリティ情報を利用したLLMの自動化分析**
   - 要求仕様から設計、実装、テストまでのトレーサビリティを機械的に分析
   - 影響範囲分析、カバレッジ分析、整合性チェックの自動化
   - LLMを活用した文書レビュー支援

2. **ローカル検索機能のクライアント・サーバ分離**
   - 本ツールをサーバとして、検索機能をクライアントとして分離
   - 複数クライアントからの並行アクセス
   - リモート環境からのアクセス

3. **他ツールとの連携**
   - CI/CDパイプラインとの統合
   - ドキュメント生成ツールとの連携
   - プロジェクト管理ツールとの連携

### 3.2 想定される利用シナリオ

**シナリオ1: LLMによる要求-設計間の整合性チェック**
```
1. API経由で要求仕様カードファイルを取得
2. API経由で設計カードファイルを取得
3. API経由でトレーサビリティ情報を取得
4. LLMに要求カードと対応する設計カードを渡して整合性を検証
5. 未トレースカードや不整合を検出して報告
```

**シナリオ2: ローカル検索アプリケーション**
```
1. クライアントアプリから検索クエリを送信
2. サーバ側で全カードファイルを横断検索
3. 検索結果（カードID、タイトル、スニペット）を返却
4. クライアントで結果を表示し、詳細取得やフィルタリングを実施
```

**シナリオ3: CI/CDパイプラインでの自動チェック**
```
1. コミット時にAPI経由でカードファイルの変更差分を検出
2. 影響範囲を自動分析（トレーサビリティ経路の探索）
3. 影響範囲のカードを自動レビュー対象としてアサイン
4. 未トレースカードを検出して警告
```

---

## 4. API機能の詳細検討

### 4.1 カードファイル操作API

#### 4.1.1 カードファイル一覧取得
- **エンドポイント:** `GET /api/v1/card-files`
- **パラメータ:**
  - `scope`: `_input` | `_out` | `all`
  - `pattern`: ファイル名パターン（glob形式）
- **レスポンス:**
  ```json
  {
    "files": [
      {
        "fileName": "requirements.json",
        "filePath": "/absolute/path/to/_out/requirements.json",
        "header": {
          "id": "uuid",
          "createdAt": "2025-11-16T10:00:00.000Z",
          "updatedAt": "2025-11-16T10:00:00.000Z",
          "cardCount": 42
        }
      }
    ]
  }
  ```

#### 4.1.2 カードファイル読み込み
- **エンドポイント:** `GET /api/v1/card-files/:fileName`
- **レスポンス:** カードファイル全体（JSON）

#### 4.1.3 カードファイル保存
- **エンドポイント:** `POST /api/v1/card-files`
- **リクエストボディ:** カードファイルJSON
- **レスポンス:**
  ```json
  {
    "fileName": "example.json",
    "savedPath": "/path/to/_out/example.json",
    "savedAt": "2025-11-16T10:00:00.000Z"
  }
  ```

#### 4.1.4 テキスト文書からカード変換
- **エンドポイント:** `POST /api/v1/convert`
- **リクエストボディ:**
  ```json
  {
    "source": "テキスト内容",
    "strategy": "rule" | "llm",
    "options": {
      "maxTitleLength": 20
    }
  }
  ```
- **レスポンス:** 変換後のカードファイルJSON

### 4.2 カード操作API

#### 4.2.1 カード取得
- **エンドポイント:** `GET /api/v1/cards/:cardId`
- **パラメータ:**
  - `fileName`: 所属するカードファイル名
- **レスポンス:** カードオブジェクト

#### 4.2.2 カード検索
- **エンドポイント:** `GET /api/v1/cards/search`
- **パラメータ:**
  - `query`: 検索クエリ
  - `useRegex`: 正規表現フラグ
  - `scope`: `active` | `open` | `all`
  - `type`: カード種別フィルタ（複数可）
  - `status`: ステータスフィルタ（複数可）
  - `limit`: 最大結果数
  - `offset`: オフセット
- **レスポンス:**
  ```json
  {
    "total": 100,
    "results": [
      {
        "fileName": "requirements.json",
        "cardId": "card-001",
        "type": "heading",
        "status": "approved",
        "title": "プロジェクト概要",
        "snippet": "…プロジェクト概要…",
        "matchCount": 3
      }
    ]
  }
  ```

#### 4.2.3 カード階層探索
- **エンドポイント:** `GET /api/v1/cards/:cardId/hierarchy`
- **パラメータ:**
  - `fileName`: カードファイル名
  - `direction`: `ancestors` | `descendants` | `siblings`
  - `depth`: 探索深度（デフォルト: 無制限）
- **レスポンス:** カードID配列

#### 4.2.4 カード作成・更新・削除
- **エンドポイント:**
  - `POST /api/v1/cards`
  - `PUT /api/v1/cards/:cardId`
  - `DELETE /api/v1/cards/:cardId`
- **リクエストボディ:** カードオブジェクト + ファイル名

### 4.3 トレーサビリティ操作API

#### 4.3.1 トレーサビリティファイル一覧取得
- **エンドポイント:** `GET /api/v1/trace-files`
- **レスポンス:**
  ```json
  {
    "files": [
      {
        "fileName": "trace_requirements_design.json",
        "leftFile": "requirements.json",
        "rightFile": "design.json",
        "relationCount": 42
      }
    ]
  }
  ```

#### 4.3.2 トレース関係取得
- **エンドポイント:** `GET /api/v1/traces`
- **パラメータ:**
  - `leftFile`: 左側カードファイル名
  - `rightFile`: 右側カードファイル名
  - `cardId`: 特定カードIDのトレース関係のみ取得（任意）
- **レスポンス:**
  ```json
  {
    "leftFile": "requirements.json",
    "rightFile": "design.json",
    "relations": [
      {
        "id": "relation-001",
        "left_ids": ["card-001"],
        "right_ids": ["card-101", "card-102"],
        "type": "trace",
        "directed": "left_to_right",
        "memo": ""
      }
    ]
  }
  ```

#### 4.3.3 トレーサビリティ経路探索
- **エンドポイント:** `GET /api/v1/traces/path`
- **パラメータ:**
  - `startFile`: 開始カードファイル名
  - `startCardId`: 開始カードID
  - `endFile`: 終了カードファイル名（任意）
  - `endCardId`: 終了カードID（任意）
  - `maxDepth`: 最大深度（デフォルト: 10）
- **レスポンス:**
  ```json
  {
    "paths": [
      {
        "length": 3,
        "nodes": [
          {"file": "requirements.json", "cardId": "card-001"},
          {"file": "design.json", "cardId": "card-101"},
          {"file": "implementation.json", "cardId": "card-201"}
        ]
      }
    ]
  }
  ```

#### 4.3.4 影響範囲分析
- **エンドポイント:** `GET /api/v1/traces/impact`
- **パラメータ:**
  - `file`: カードファイル名
  - `cardId`: 基点カードID
  - `direction`: `forward` | `backward` | `both`
  - `maxDepth`: 最大深度
- **レスポンス:**
  ```json
  {
    "impactedCards": [
      {
        "file": "design.json",
        "cardId": "card-101",
        "distance": 1,
        "relationType": "trace"
      },
      {
        "file": "implementation.json",
        "cardId": "card-201",
        "distance": 2,
        "relationType": "refines"
      }
    ]
  }
  ```

#### 4.3.5 カバレッジ分析
- **エンドポイント:** `GET /api/v1/traces/coverage`
- **パラメータ:**
  - `sourceFile`: ソースカードファイル名
  - `targetFile`: ターゲットカードファイル名（任意、省略時は全ファイル）
- **レスポンス:**
  ```json
  {
    "sourceFile": "requirements.json",
    "totalCards": 100,
    "tracedCards": 85,
    "untracedCards": 15,
    "coverageRate": 0.85,
    "untracedCardIds": ["card-010", "card-025", ...]
  }
  ```

#### 4.3.6 トレース関係の作成・削除
- **エンドポイント:**
  - `POST /api/v1/traces`
  - `DELETE /api/v1/traces/:relationId`
- **リクエストボディ:**
  ```json
  {
    "leftFile": "requirements.json",
    "rightFile": "design.json",
    "left_ids": ["card-001"],
    "right_ids": ["card-101"],
    "type": "trace",
    "directed": "left_to_right",
    "memo": ""
  }
  ```

### 4.4 統計・分析API

#### 4.4.1 カードファイル統計
- **エンドポイント:** `GET /api/v1/stats/card-file/:fileName`
- **レスポンス:**
  ```json
  {
    "fileName": "requirements.json",
    "totalCards": 100,
    "cardsByType": {
      "heading": 20,
      "paragraph": 50,
      "bullet": 30
    },
    "cardsByStatus": {
      "draft": 10,
      "review": 20,
      "approved": 70
    },
    "maxDepth": 5,
    "avgDepth": 2.3
  }
  ```

#### 4.4.2 プロジェクト全体統計
- **エンドポイント:** `GET /api/v1/stats/project`
- **レスポンス:**
  ```json
  {
    "totalCardFiles": 10,
    "totalCards": 1000,
    "totalTraceFiles": 15,
    "totalRelations": 500,
    "cardsByType": { ... },
    "cardsByStatus": { ... },
    "tracesByType": {
      "trace": 300,
      "refines": 100,
      "tests": 100
    }
  }
  ```

### 4.5 LLM連携API

#### 4.5.1 カード要約
- **エンドポイント:** `POST /api/v1/llm/summarize`
- **リクエストボディ:**
  ```json
  {
    "file": "requirements.json",
    "cardIds": ["card-001", "card-002"],
    "maxTokens": 200
  }
  ```
- **レスポンス:**
  ```json
  {
    "summaries": [
      {
        "cardId": "card-001",
        "summary": "プロジェクトの概要を記述..."
      }
    ]
  }
  ```

#### 4.5.2 トレース妥当性チェック
- **エンドポイント:** `POST /api/v1/llm/validate-trace`
- **リクエストボディ:**
  ```json
  {
    "leftFile": "requirements.json",
    "rightFile": "design.json",
    "relationId": "relation-001"
  }
  ```
- **レスポンス:**
  ```json
  {
    "valid": true,
    "confidence": 0.85,
    "reason": "要求カードと設計カードの内容が整合している",
    "suggestions": []
  }
  ```

#### 4.5.3 未トレースカードの推奨
- **エンドポイント:** `POST /api/v1/llm/suggest-traces`
- **リクエストボディ:**
  ```json
  {
    "sourceFile": "requirements.json",
    "targetFile": "design.json",
    "untracedCardIds": ["card-010", "card-025"]
  }
  ```
- **レスポンス:**
  ```json
  {
    "suggestions": [
      {
        "sourceCardId": "card-010",
        "targetCardIds": ["card-105", "card-106"],
        "confidence": 0.78,
        "reason": "要求内容と設計項目の類似性が高い"
      }
    ]
  }
  ```

#### 4.5.4 不整合検出
- **エンドポイント:** `POST /api/v1/llm/detect-inconsistencies`
- **リクエストボディ:**
  ```json
  {
    "files": ["requirements.json", "design.json", "implementation.json"]
  }
  ```
- **レスポンス:**
  ```json
  {
    "inconsistencies": [
      {
        "type": "content_mismatch",
        "severity": "high",
        "sourceCard": {
          "file": "requirements.json",
          "cardId": "card-001"
        },
        "targetCard": {
          "file": "design.json",
          "cardId": "card-101"
        },
        "description": "要求では機能Aが必須だが、設計では任意となっている"
      }
    ]
  }
  ```

---

## 5. 現実的な実現方法

### 5.1 アーキテクチャオプション

#### オプション1: Electron IPCベースのAPI
**概要:**
- 既存のElectronメインプロセスを拡張してAPI機能を提供
- IPC経由でAPIを公開
- レンダラプロセスがクライアントとして機能

**利点:**
- 既存コードの再利用が容易
- Electronの機能をそのまま利用可能
- デスクトップアプリとしての統合性が高い

**欠点:**
- Electronプロセスが必要（リモートアクセス不可）
- パフォーマンス制限（Electronのオーバーヘッド）
- スケーラビリティが低い

**推奨度:** ★★☆☆☆（デスクトップアプリ内部でのAPI利用のみに適している）

#### オプション2: 独立したHTTP REST APIサーバ
**概要:**
- 既存のコア機能を切り出してNode.js HTTPサーバとして実装
- RESTful APIで標準的なエンドポイントを提供
- Express.jsやFastifyなどのフレームワークを使用

**利点:**
- 標準的なAPI設計
- 多様なクライアントから利用可能（HTTP経由）
- スケーラビリティが高い
- 既存のHTTPツール・ライブラリとの連携が容易

**欠点:**
- コアロジックの切り出しと再実装が必要
- デスクトップアプリとサーバの二重管理

**推奨度:** ★★★★☆（汎用性とスケーラビリティに優れる）

#### オプション3: GraphQL API
**概要:**
- GraphQLスキーマを定義してAPI提供
- クライアントが必要なデータのみを効率的に取得可能
- Apollo ServerやGraphQL Yogaなどを使用

**利点:**
- クライアントが柔軟にクエリを構築可能
- 過剰フェッチ・過少フェッチの問題を解決
- 型安全性が高い

**欠点:**
- GraphQLスキーマ設計が複雑
- キャッシング戦略が難しい
- REST APIより学習コストが高い

**推奨度:** ★★★☆☆（複雑なクエリが必要な場合に有効）

#### オプション4: MCP (Model Context Protocol) サーバ
**概要:**
- Claude Desktopなどから利用できるMCPサーバとして実装
- LLMツールとしての利用に最適化
- stdio、SSE、WebSocket経由で通信

**利点:**
- LLM連携に特化した設計
- Claude Codeから直接利用可能
- セキュアな通信（ローカルプロセス）

**欠点:**
- MCP仕様への対応が必要
- LLM以外の用途には不向き
- MCP対応クライアントが限定的

**推奨度:** ★★★★☆（LLM連携機能に特化する場合に最適）

### 5.2 推奨アーキテクチャ: ハイブリッドアプローチ

**段階的な実装:**
1. **フェーズ1: コアロジックの分離**
   - 既存コードから再利用可能なコアロジックを`src/core`に切り出し
   - ファイルI/O、カード操作、トレーサビリティ管理をライブラリ化
   - Electronアプリとサーバの両方から利用可能にする

2. **フェーズ2: HTTP REST APIサーバの実装**
   - Express.jsベースのREST APIサーバを実装
   - 基本的なCRUD操作と検索機能を提供
   - OpenAPI (Swagger) ドキュメントを自動生成

3. **フェーズ3: MCPサーバの実装**
   - LLM連携機能に特化したMCPサーバを実装
   - カード要約、トレース妥当性チェック、不整合検出をツールとして提供
   - Claude Codeから直接利用可能にする

4. **フェーズ4: GraphQL APIの追加（オプション）**
   - 複雑なクエリが必要になった場合に追加
   - REST APIと並行して提供

**推奨構成:**
```
mdsplitter/
├── src/
│   ├── core/              # コアロジック（共通ライブラリ）
│   │   ├── card.ts        # カード操作
│   │   ├── trace.ts       # トレーサビリティ
│   │   ├── search.ts      # 検索機能
│   │   └── workspace.ts   # ワークスペース管理
│   ├── server/            # HTTPサーバ
│   │   ├── rest/          # REST API
│   │   └── graphql/       # GraphQL API（将来）
│   ├── mcp/               # MCPサーバ
│   │   └── tools/         # LLM連携ツール
│   ├── main/              # Electronメインプロセス
│   └── renderer/          # Electronレンダラープロセス
```

---

## 6. 必要なライブラリ・技術スタック

### 6.1 コア機能（既存）
- **TypeScript**: 型安全な開発
- **Node.js**: サーバサイド実行環境
- **zod**: バリデーションとスキーマ定義

### 6.2 HTTP REST APIサーバ
- **Express.js** または **Fastify**: HTTPサーバフレームワーク
- **cors**: CORS対応
- **helmet**: セキュリティヘッダ
- **compression**: レスポンス圧縮
- **express-rate-limit**: レート制限
- **swagger-ui-express** + **swagger-jsdoc**: API ドキュメント自動生成

### 6.3 GraphQL API（オプション）
- **Apollo Server** または **GraphQL Yoga**: GraphQLサーバ
- **graphql-codegen**: TypeScript型定義自動生成
- **dataloader**: N+1問題対策

### 6.4 MCPサーバ
- **@modelcontextprotocol/sdk**: MCP SDK
- **stdio-transport** または **sse-transport**: 通信プロトコル

### 6.5 LLM連携
- **openai**: OpenAI API クライアント
- **@google/generative-ai**: Gemini API クライアント
- **langchain**: LLMオーケストレーション（任意）

### 6.6 検索・分析
- **fuse.js**: あいまい検索（任意）
- **natural**: 自然言語処理（任意）

### 6.7 テスト
- **supertest**: HTTP APIテスト
- **nock**: HTTP モック
- **@modelcontextprotocol/sdk/testing**: MCPテスト

### 6.8 ドキュメント
- **typedoc**: TypeScript APIドキュメント生成
- **redoc**: OpenAPI仕様の美しい表示

---

## 7. 実現順序（タスク分割）

### フェーズ1: コアロジックの分離とライブラリ化（2〜3週間）

**目的:** 既存コードから再利用可能なコアロジックを切り出し、Electronアプリとサーバの両方から利用できるようにする。

**タスク:**
1. **T1-1:** `src/core`ディレクトリを作成し、既存コードから以下のモジュールを抽出
   - カードファイルの読み書き（`src/main/workspace.ts` から）
   - トレーサビリティファイルの読み書き（`src/main/workspace.ts` から）
   - カード操作ロジック（`src/renderer/store/workspaceStore.ts` から）
   - 検索機能（`src/renderer/utils/search.ts` から）
   - カード変換機能（`src/shared/conversion/` から）

2. **T1-2:** コアロジックをNode.js環境で動作するように調整
   - Electronやブラウザ固有のAPIを除去
   - ファイルI/OをPromiseベースに統一
   - 依存関係を最小化

3. **T1-3:** コアロジックのユニットテスト作成
   - カードCRUD操作のテスト
   - トレーサビリティ操作のテスト
   - 検索機能のテスト

4. **T1-4:** Electronアプリから新しいコアロジックを利用するように移行
   - 既存コードをリファクタリング
   - 回帰テストの実施

**成果物:**
- `src/core/` ディレクトリとライブラリコード
- ユニットテストスイート
- Electronアプリの動作確認

---

### フェーズ2: HTTP REST APIサーバの基礎実装（3〜4週間）

**目的:** 基本的なCRUD操作と検索機能を提供するHTTP REST APIサーバを実装。

**タスク:**
1. **T2-1:** プロジェクト構造の構築
   - `src/server/rest/` ディレクトリ作成
   - Express.jsのセットアップ
   - TypeScript設定（`tsconfig.server.json`）

2. **T2-2:** カードファイル操作APIの実装
   - `GET /api/v1/card-files`: カードファイル一覧取得
   - `GET /api/v1/card-files/:fileName`: カードファイル読み込み
   - `POST /api/v1/card-files`: カードファイル保存
   - `POST /api/v1/convert`: テキストからカード変換

3. **T2-3:** カード操作APIの実装
   - `GET /api/v1/cards/:cardId`: カード取得
   - `GET /api/v1/cards/search`: カード検索
   - `GET /api/v1/cards/:cardId/hierarchy`: カード階層探索
   - `POST /api/v1/cards`: カード作成
   - `PUT /api/v1/cards/:cardId`: カード更新
   - `DELETE /api/v1/cards/:cardId`: カード削除

4. **T2-4:** エラーハンドリングとバリデーション
   - zod によるリクエストバリデーション
   - エラーレスポンスの統一
   - ログ記録

5. **T2-5:** OpenAPI ドキュメント作成
   - Swagger仕様の定義
   - Swagger UIの統合（`/api-docs`）

6. **T2-6:** APIテストの作成
   - supertestによる統合テスト
   - 主要エンドポイントのテストケース

**成果物:**
- HTTP REST APIサーバ（`src/server/rest/`）
- OpenAPI仕様書
- APIテストスイート
- サーバ起動スクリプト（`npm run server`）

---

### フェーズ3: トレーサビリティ・分析APIの実装（3〜4週間）

**目的:** トレーサビリティの取得、探索、影響範囲分析などの高度な機能を提供。

**タスク:**
1. **T3-1:** トレーサビリティファイル操作APIの実装
   - `GET /api/v1/trace-files`: トレーサビリティファイル一覧取得
   - `GET /api/v1/traces`: トレース関係取得
   - `POST /api/v1/traces`: トレース関係作成
   - `DELETE /api/v1/traces/:relationId`: トレース関係削除

2. **T3-2:** トレーサビリティ経路探索アルゴリズムの実装
   - 幅優先探索（BFS）による経路探索
   - 深さ優先探索（DFS）による影響範囲分析
   - 循環参照の検出と回避

3. **T3-3:** トレーサビリティ分析APIの実装
   - `GET /api/v1/traces/path`: トレーサビリティ経路探索
   - `GET /api/v1/traces/impact`: 影響範囲分析
   - `GET /api/v1/traces/coverage`: カバレッジ分析

4. **T3-4:** 統計・分析APIの実装
   - `GET /api/v1/stats/card-file/:fileName`: カードファイル統計
   - `GET /api/v1/stats/project`: プロジェクト全体統計

5. **T3-5:** パフォーマンス最適化
   - 大規模データセットでの性能測定
   - キャッシング戦略の実装
   - インデックス構築（必要に応じて）

**成果物:**
- トレーサビリティ・分析API
- 経路探索アルゴリズム
- パフォーマンステスト結果

---

### フェーズ4: MCPサーバとLLM連携機能の実装（3〜4週間）

**目的:** LLM連携に特化したMCPサーバを実装し、Claude Codeから直接利用可能にする。

**タスク:**
1. **T4-1:** MCPサーバのセットアップ
   - `src/mcp/` ディレクトリ作成
   - MCP SDKのインストールと設定
   - stdio transportの実装

2. **T4-2:** 基本的なMCPツールの実装
   - `list_card_files`: カードファイル一覧取得
   - `read_card_file`: カードファイル読み込み
   - `search_cards`: カード検索
   - `get_trace_relations`: トレース関係取得
   - `analyze_impact`: 影響範囲分析
   - `analyze_coverage`: カバレッジ分析

3. **T4-3:** LLM連携ツールの実装
   - `summarize_cards`: カード要約
   - `validate_trace`: トレース妥当性チェック
   - `suggest_traces`: 未トレースカードの推奨
   - `detect_inconsistencies`: 不整合検出

4. **T4-4:** LLM API連携
   - OpenAI APIクライアントの実装
   - Gemini APIクライアントの実装（オプション）
   - プロンプトテンプレートの作成

5. **T4-5:** MCPサーバのテスト
   - MCP SDKのテストツールを使用
   - 各ツールの動作確認
   - Claude Codeとの統合テスト

6. **T4-6:** ドキュメント作成
   - MCP ツールの仕様書
   - 使用例とベストプラクティス

**成果物:**
- MCPサーバ（`src/mcp/`）
- LLM連携ツール
- MCPサーバ起動スクリプト（`npm run mcp`）
- ツール仕様書

---

### フェーズ5: 認証・認可とセキュリティ強化（2〜3週間）

**目的:** APIサーバのセキュリティを強化し、本番環境での利用に備える。

**タスク:**
1. **T5-1:** 認証機能の実装
   - JWTトークンベースの認証
   - APIキー認証（簡易版）
   - ユーザー管理機能（基本）

2. **T5-2:** 認可機能の実装
   - ロールベースのアクセス制御（RBAC）
   - リソースレベルの権限管理

3. **T5-3:** セキュリティヘッダとCSRF対策
   - helmet によるセキュリティヘッダ設定
   - CSRF トークン
   - CORS設定の厳格化

4. **T5-4:** レート制限とDoS対策
   - express-rate-limit による制限
   - リクエストサイズ制限
   - タイムアウト設定

5. **T5-5:** 監査ログ
   - API操作の記録
   - ログローテーション
   - セキュリティイベントの検出

**成果物:**
- 認証・認可機能
- セキュリティ強化されたAPIサーバ
- 監査ログ機能

---

### フェーズ6: GraphQL API実装（オプション、3〜4週間）

**目的:** 複雑なクエリが必要な場合にGraphQL APIを追加提供。

**タスク:**
1. **T6-1:** GraphQLスキーマ設計
   - カード、トレーサビリティのスキーマ定義
   - クエリ、ミューテーション、サブスクリプションの設計

2. **T6-2:** Apollo Serverのセットアップ
   - `src/server/graphql/` ディレクトリ作成
   - Apollo Serverの設定

3. **T6-3:** リゾルバの実装
   - クエリリゾルバ
   - ミューテーションリゾルバ
   - DataLoaderによるN+1問題対策

4. **T6-4:** GraphQL Playgroundの統合
   - `/graphql` エンドポイント
   - スキーマドキュメントの自動生成

5. **T6-5:** テストとパフォーマンス測定
   - GraphQLクエリのテスト
   - パフォーマンスプロファイリング

**成果物:**
- GraphQL API（`src/server/graphql/`）
- GraphQL Playground
- スキーマドキュメント

---

### フェーズ7: 本番環境対応とデプロイ準備（2〜3週間）

**目的:** 本番環境での運用に必要な機能とデプロイ手順を整備。

**タスク:**
1. **T7-1:** 設定管理
   - 環境変数による設定
   - `.env` ファイルのサポート
   - 環境別設定（開発、ステージング、本番）

2. **T7-2:** ロギングと監視
   - 構造化ログ（JSON形式）
   - ログレベルの制御
   - メトリクス収集（Prometheus対応）

3. **T7-3:** ヘルスチェックとメトリクス
   - `/health` エンドポイント
   - `/metrics` エンドポイント
   - リソース使用状況の監視

4. **T7-4:** Dockerコンテナ化
   - Dockerfile作成
   - docker-compose.yml作成
   - マルチステージビルド

5. **T7-5:** デプロイドキュメント
   - インストール手順
   - 設定ガイド
   - トラブルシューティング

**成果物:**
- Dockerコンテナイメージ
- docker-compose設定
- デプロイドキュメント

---

## 8. 見積もりと優先順位

### 8.1 開発期間見積もり

| フェーズ | 期間 | 優先度 | 依存関係 |
|---------|------|--------|----------|
| フェーズ1: コアロジック分離 | 2〜3週間 | 必須 | なし |
| フェーズ2: HTTP REST API基礎 | 3〜4週間 | 必須 | フェーズ1 |
| フェーズ3: トレーサビリティAPI | 3〜4週間 | 高 | フェーズ2 |
| フェーズ4: MCPサーバ・LLM連携 | 3〜4週間 | 高 | フェーズ1 |
| フェーズ5: セキュリティ強化 | 2〜3週間 | 中 | フェーズ2 |
| フェーズ6: GraphQL API | 3〜4週間 | 低 | フェーズ2 |
| フェーズ7: 本番環境対応 | 2〜3週間 | 中 | フェーズ2, 4, 5 |

**最小構成（MVP）:** フェーズ1 + フェーズ2 → 5〜7週間
**推奨構成:** フェーズ1 + フェーズ2 + フェーズ3 + フェーズ4 → 11〜15週間
**フル機能:** 全フェーズ → 18〜25週間

### 8.2 優先順位の推奨

**最優先（MVP）:**
1. フェーズ1: コアロジック分離
2. フェーズ2: HTTP REST API基礎

**次優先:**
3. フェーズ4: MCPサーバ・LLM連携（LLM活用を重視する場合）
4. フェーズ3: トレーサビリティAPI（分析機能を重視する場合）

**追加機能:**
5. フェーズ5: セキュリティ強化
6. フェーズ7: 本番環境対応

**オプション:**
7. フェーズ6: GraphQL API

---

## 9. リスクと対策

### 9.1 技術的リスク

**R1: コアロジックの抽出が複雑**
- **リスク:** 既存コードがElectron/React固有の実装に深く依存している可能性
- **対策:**
  - 段階的なリファクタリング
  - 抽象化レイヤの導入
  - 十分なテストカバレッジ

**R2: パフォーマンス問題**
- **リスク:** 大規模データセット（10,000カード以上）でのAPI応答が遅い
- **対策:**
  - ページネーション実装
  - キャッシング戦略
  - データベース導入（SQLiteやPostgreSQL）検討

**R3: LLM API コスト**
- **リスク:** LLM連携機能が高コストになる可能性
- **対策:**
  - プロンプト最適化
  - キャッシング（同一クエリの結果再利用）
  - レート制限
  - ローカルLLM（Ollama）のサポート

### 9.2 運用リスク

**R4: セキュリティ脆弱性**
- **リスク:** 認証・認可が不十分で不正アクセスされる
- **対策:**
  - フェーズ5のセキュリティ強化を早期実施
  - 定期的な脆弱性スキャン
  - セキュリティベストプラクティスの遵守

**R5: ドキュメント不足**
- **リスク:** API仕様が不明確で利用者が混乱
- **対策:**
  - OpenAPI仕様書の整備
  - サンプルコードの充実
  - インタラクティブなドキュメント（Swagger UI）

---

## 10. まとめと次のステップ

### 10.1 まとめ

本レポートでは、mdsplitterをAPI経由で利用可能にするための包括的な検討を行いました。

**主な提案内容:**
1. **段階的なAPI化アプローチ（7フェーズ）**
2. **3つの実装方式の併用（HTTP REST API、MCP、GraphQL）**
3. **トレーサビリティ情報を活用したLLM連携機能**
4. **詳細なAPI仕様と実装タスクの定義**

**期待される効果:**
- LLMによる自動分析・レビュー支援
- ローカル検索機能のクライアント・サーバ分離
- 他ツールとの連携
- CI/CDパイプラインへの統合

### 10.2 次のステップ

1. **ステークホルダーレビュー**
   - 本レポートのレビューとフィードバック収集
   - 優先順位の最終決定

2. **フェーズ1の着手準備**
   - 開発環境のセットアップ
   - タスク詳細化とスケジュール作成
   - チーム編成（必要に応じて）

3. **プロトタイプ開発（2週間）**
   - フェーズ1の一部を先行実装
   - 技術的実現可能性の検証
   - パフォーマンス初期測定

4. **MVP開発（5〜7週間）**
   - フェーズ1とフェーズ2の完全実装
   - 基本的なREST APIの提供
   - デモと評価

---

## 付録A: API仕様サンプル

### A.1 カード検索APIの詳細例

**エンドポイント:** `GET /api/v1/cards/search`

**クエリパラメータ:**
```
?query=プロジェクト
&useRegex=false
&scope=all
&type=heading,paragraph
&status=approved
&limit=20
&offset=0
```

**レスポンス:**
```json
{
  "total": 100,
  "limit": 20,
  "offset": 0,
  "results": [
    {
      "fileName": "requirements.json",
      "cardId": "card-001",
      "type": "heading",
      "status": "approved",
      "title": "プロジェクト概要",
      "content": {
        "text": "本プロジェクトは...",
        "number": null
      },
      "snippet": "…本プロジェクトは…",
      "matchCount": 3,
      "hierarchy": {
        "level": 0,
        "parent_id": null,
        "child_count": 5
      },
      "updatedAt": "2025-11-16T10:00:00.000Z"
    }
  ]
}
```

### A.2 影響範囲分析APIの詳細例

**エンドポイント:** `GET /api/v1/traces/impact`

**クエリパラメータ:**
```
?file=requirements.json
&cardId=card-001
&direction=forward
&maxDepth=3
```

**レスポンス:**
```json
{
  "baseCard": {
    "file": "requirements.json",
    "cardId": "card-001",
    "title": "プロジェクト概要"
  },
  "direction": "forward",
  "maxDepth": 3,
  "totalImpactedCards": 15,
  "impactedCards": [
    {
      "file": "design.json",
      "cardId": "card-101",
      "title": "システム設計概要",
      "distance": 1,
      "relationType": "trace",
      "path": [
        {"file": "requirements.json", "cardId": "card-001"},
        {"file": "design.json", "cardId": "card-101"}
      ]
    },
    {
      "file": "implementation.json",
      "cardId": "card-201",
      "title": "モジュールA実装",
      "distance": 2,
      "relationType": "refines",
      "path": [
        {"file": "requirements.json", "cardId": "card-001"},
        {"file": "design.json", "cardId": "card-101"},
        {"file": "implementation.json", "cardId": "card-201"}
      ]
    }
  ]
}
```

---

## 付録B: MCP ツール仕様サンプル

### B.1 カード検索ツール (search_cards)

**ツール名:** `search_cards`

**説明:** カードファイルを横断してカードを検索します。

**入力スキーマ:**
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "検索クエリ（文字列または正規表現）"
    },
    "useRegex": {
      "type": "boolean",
      "description": "正規表現を使用するか",
      "default": false
    },
    "scope": {
      "type": "string",
      "enum": ["active", "open", "all"],
      "description": "検索範囲",
      "default": "all"
    },
    "type": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["heading", "paragraph", "bullet", "figure", "table", "test", "qa", "other"]
      },
      "description": "カード種別フィルタ"
    },
    "status": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["draft", "review", "approved", "deprecated"]
      },
      "description": "ステータスフィルタ"
    },
    "limit": {
      "type": "number",
      "description": "最大結果数",
      "default": 20
    }
  },
  "required": ["query"]
}
```

**出力例:**
```json
{
  "total": 100,
  "results": [
    {
      "fileName": "requirements.json",
      "cardId": "card-001",
      "type": "heading",
      "status": "approved",
      "title": "プロジェクト概要",
      "snippet": "…本プロジェクトは…",
      "matchCount": 3
    }
  ]
}
```

### B.2 影響範囲分析ツール (analyze_impact)

**ツール名:** `analyze_impact`

**説明:** 特定カードの変更が影響する範囲を分析します。

**入力スキーマ:**
```json
{
  "type": "object",
  "properties": {
    "file": {
      "type": "string",
      "description": "カードファイル名"
    },
    "cardId": {
      "type": "string",
      "description": "基点カードID"
    },
    "direction": {
      "type": "string",
      "enum": ["forward", "backward", "both"],
      "description": "影響の方向性",
      "default": "forward"
    },
    "maxDepth": {
      "type": "number",
      "description": "最大探索深度",
      "default": 10
    }
  },
  "required": ["file", "cardId"]
}
```

**出力例:**
```json
{
  "baseCard": {
    "file": "requirements.json",
    "cardId": "card-001",
    "title": "プロジェクト概要"
  },
  "totalImpactedCards": 15,
  "impactedCards": [
    {
      "file": "design.json",
      "cardId": "card-101",
      "title": "システム設計概要",
      "distance": 1,
      "relationType": "trace"
    }
  ]
}
```

---

## 付録C: 参考資料

- **OpenAPI Specification:** https://swagger.io/specification/
- **GraphQL Specification:** https://spec.graphql.org/
- **Model Context Protocol (MCP):** https://modelcontextprotocol.io/
- **Express.js:** https://expressjs.com/
- **Apollo Server:** https://www.apollographql.com/docs/apollo-server/
- **TypeScript:** https://www.typescriptlang.org/
- **zod:** https://zod.dev/

---

**本レポートに関するお問い合わせ:**
作成者: Claude (Anthropic)
作成日: 2025-11-16
