# CONTRIBUTING

## パッケージマネージャ方針
- Node.js のバージョンは `.nvmrc` に従って `v22.6.0` を利用する。
- パッケージマネージャは `npm` を標準とし、`yarn` / `pnpm` などは使用しない。
- 依存追加は `npm install <pkg>` / `npm install -D <pkg>` を利用する。
- 依存更新は `npm update` ではなく、必要最小限のバージョンに明示更新する。
- `package-lock.json` を常にバージョン管理し、手動編集は行わない。
- 再現性を担保するため、CI・本番では `npm ci` を利用する。

## 開発環境セットアップ
1. `nvm use` で指定バージョンに切り替える。
2. `npm ci` で依存関係をインストールする。
3. `npm run lint` / `npm run typecheck` / `npm test` を実行し基本的な検証を行う。

## 依存追加時の手順
1. 変更の目的を `journal/journal_yyyymmdd.txt` に記録する。
2. `npm install (-D)` を実行して `package.json` と `package-lock.json` を更新する。
3. 影響範囲のテストを実行し結果を共有する。
4. 変更内容を仕様書・設計書にも反映する。
