# Git Commit Message Guideline (LLM簡易版)

## 🧭 基本方針

* 1コミット = 1目的（論理的に独立した変更）。
* LLM生成コードを含む場合も、**最終的な責任は開発者にある**。
* コミットは常にビルド・テストが通る状態で行う。
* プロンプトや機密情報はコミットメッセージに含めない。

---

## 🧩 コミットメッセージ構造

```
<type>(<scope>): <subject>

<body>

<footer>
```

### type（変更種別）

| type     | 内容               |
| -------- | ---------------- |
| feat     | 新機能の追加           |
| fix      | バグ修正             |
| refactor | リファクタリング（機能変更なし） |
| docs     | ドキュメント更新         |
| test     | テスト追加・修正         |
| style    | フォーマット・命名修正      |
| chore    | 設定・CI・依存更新など     |

### scope（任意）

対象範囲（例：`api`、`ui`、`infra` など）

### subject

* 命令形で簡潔に（例：`add`, `fix`, `remove`）
* 日本語50文字以内
* 文末ピリオド、句読不要
  例：`feat(api): JWT認証機能を追加`

---

## 📄 body（任意）

変更理由や背景、影響範囲を簡潔に記載。
日本語で記載する。

例：
```
ステートレス認証のために JWT ミドルウェアを導入。
この変更により、スケーラビリティが向上し、セッション管理が簡素化する。
```

---

## 🧠 footer（LLM利用メタ情報）

LLMを利用した実装の場合、以下を追記してください。
（機密やプロンプト本文は**絶対に記載しない**）

```
LLM-Coauthored-By: gpt-5 @ OpenAI
LLM-Model: gpt-5-2025-10
Ticket: JIRA-1234
```

### 必須項目（LLM使用時）

* `LLM-Coauthored-By`: モデル名と提供元
* `LLM-Model`: 厳密なモデルバージョン
* `Ticket`: 課題トラッカー番号（あれば）

---

## ✍️ 例

### 通常コミット

```
feat(api): add idempotent create-order endpoint

Implements PUT /orders/{id} to avoid duplicate creation.
Returns 200 when same idempotency key is reused.

Ticket: JIRA-2048
```

### LLM併用コミット

```
fix(ui): correct timezone display on event calendar

Normalize event timestamps to user's timezone before rendering.
Verified via Cypress test suite.

LLM-Coauthored-By: gpt-5 @ OpenAI
LLM-Model: gpt-5-2025-10
Ticket: UI-331
```

---

## 🚦 運用ルール

* コミット実行時は必ず確認を取ること。
* 機密・内部URL・プロンプト本文の直接記載は禁止。
