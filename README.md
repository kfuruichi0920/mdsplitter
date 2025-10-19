# Card Editor Application

カード編集アプリケーション - Electron + React + TypeScript

## プロジェクト概要

テキストファイル（.txt、.md）をカード形式のJSON構造に変換し、視覚的に編集・管理するためのデスクトップアプリケーション。

## 技術スタック

- **Electron**: デスクトップアプリケーションフレームワーク
- **React**: UIライブラリ
- **TypeScript**: 型安全な開発
- **Tailwind CSS**: ユーティリティファーストCSSフレームワーク
- **Zustand**: 状態管理ライブラリ
- **Webpack**: モジュールバンドラー

## 開発環境のセットアップ

### 前提条件

- Node.js 18.x 以上
- npm または yarn

### インストール

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

### 利用可能なスクリプト

```bash
# 開発モード（ホットリロード）
npm run dev

# レンダラープロセスのみ開発
npm run dev:renderer

# メインプロセスのみビルド（ウォッチモード）
npm run dev:main

# プロダクションビルド
npm run build

# アプリケーション起動
npm start

# Lint実行
npm run lint

# Lint修正
npm run lint:fix

# コードフォーマット
npm run format

# 型チェック
npm run type-check

# パッケージング（全プラットフォーム）
npm run package

# Windows向けパッケージング
npm run package:win

# macOS向けパッケージング
npm run package:mac

# Linux向けパッケージング
npm run package:linux
```

## プロジェクト構造

```
mdsplitter/
├── src/
│   ├── main/              # Electronメインプロセス
│   │   ├── main.ts        # アプリケーションエントリーポイント
│   │   └── preload.ts     # プリロードスクリプト
│   ├── renderer/          # Reactアプリケーション
│   │   ├── components/    # Reactコンポーネント
│   │   ├── styles/        # CSSファイル
│   │   ├── store/         # Zustand状態管理
│   │   ├── hooks/         # カスタムフック
│   │   ├── utils/         # ユーティリティ関数
│   │   ├── App.tsx        # メインアプリコンポーネント
│   │   ├── index.tsx      # Reactエントリーポイント
│   │   └── index.html     # HTMLテンプレート
│   └── shared/            # 共有型定義・ユーティリティ
├── dist/                  # ビルド出力
├── build/                 # パッケージング出力
├── doc/                   # ドキュメント
├── spec/                  # 仕様書
├── _input/                # 入力ファイル（作業ディレクトリ）
├── _out/                  # 出力ファイル（作業ディレクトリ）
├── _logs/                 # ログファイル
├── package.json           # npm設定
├── tsconfig.json          # TypeScript設定
├── webpack.config.js      # Webpack設定
├── tailwind.config.js     # Tailwind CSS設定
├── postcss.config.js      # PostCSS設定
├── .eslintrc.json         # ESLint設定
└── .prettierrc            # Prettier設定
```

## 開発フェーズ

現在のステータス: **フェーズ1 - プロジェクト基盤構築**

- [x] タスク1.1: プロジェクトセットアップ
- [ ] タスク1.2: Tailwind CSS セットアップ
- [ ] タスク1.3: 状態管理ライブラリ導入
- [ ] タスク1.4: 基本UIレイアウト実装
- [ ] タスク1.5: パネル分割機能実装
- [ ] タスク1.6: テーマシステム実装

詳細は [初期開発計画](spec/初期開発計画_Claude_251019.md) を参照してください。

## ライセンス

MIT

## 作成者

Card Editor Team
