/**
 * @file card-display-mode.spec.ts
 * @brief カード表示モード切替の統合テスト。
 * @details
 * 詳細表示とコンパクト表示の切替動作をE2Eテストで検証。
 * @author K.Furuichi
 * @date 2025-11-07
 * @version 0.1
 * @copyright MIT
 */
import { expect, test } from '@playwright/test';

/**
 * @brief カード表示モードの統合テスト。
 * @details
 * アプリ起動後、カードファイルを開き、コンパクト表示切替ボタンの動作を確認する。
 */
test.describe('Card Display Mode', () => {
  test.skip('should toggle between detailed and compact display modes', async ({ page }) => {
    //! Note: このテストはアプリのUIが完全に実装されてから有効化する。
    //! 現在はアプリ起動とファイル読み込みの実装が必要なためスキップ。

    // アプリURLにアクセス（開発サーバーまたはビルド済みアプリ）
    await page.goto('http://localhost:5173'); // Vite開発サーバーを想定

    // カードファイルを開く操作（実装に応じて変更）
    // 例: エクスプローラからファイルをクリックする
    // await page.click('[data-testid="explorer-file-sample"]');

    // 最初は詳細表示であることを確認
    const firstCard = page.locator('.card').first();
    await expect(firstCard).not.toHaveClass(/card--compact/);
    await expect(firstCard.locator('.card__body')).toBeVisible();
    await expect(firstCard.locator('.card__footer')).toBeVisible();

    // コンパクト表示ボタンをクリック
    await page.click('button:has-text("☰ コンパクト")');

    // コンパクト表示に切り替わったことを確認
    await expect(firstCard).toHaveClass(/card--compact/);
    await expect(firstCard.locator('.card__body')).not.toBeVisible();
    await expect(firstCard.locator('.card__footer')).not.toBeVisible();

    // ボタンがアクティブ状態であることを確認
    const compactButton = page.locator('button:has-text("☰ コンパクト")');
    await expect(compactButton).toHaveClass(/panel-toolbar__button--active/);

    // もう一度クリックして詳細表示に戻す
    await page.click('button:has-text("☰ コンパクト")');

    // 詳細表示に戻ったことを確認
    await expect(firstCard).not.toHaveClass(/card--compact/);
    await expect(firstCard.locator('.card__body')).toBeVisible();
    await expect(firstCard.locator('.card__footer')).toBeVisible();

    // ボタンが非アクティブ状態であることを確認
    await expect(compactButton).not.toHaveClass(/panel-toolbar__button--active/);
  });

  test.skip('should maintain display mode when switching tabs', async ({ page }) => {
    //! Note: タブ切替実装後に有効化する。

    await page.goto('http://localhost:5173');

    // コンパクト表示に切り替え
    await page.click('button:has-text("☰ コンパクト")');

    // 別のタブを開く（実装に応じて変更）
    // await page.click('[data-testid="open-second-file"]');

    // 元のタブに戻る
    // await page.click('[data-testid="tab-first-file"]');

    // コンパクト表示が維持されていることを確認
    const firstCard = page.locator('.card').first();
    await expect(firstCard).toHaveClass(/card--compact/);
  });

  test.skip('should log display mode changes', async ({ page }) => {
    //! Note: ログエリアの実装確認後に有効化する。

    await page.goto('http://localhost:5173');

    // コンパクト表示に切り替え
    await page.click('button:has-text("☰ コンパクト")');

    // ログエリアに切替メッセージが表示されることを確認
    const logArea = page.locator('.log-area__body');
    await expect(logArea).toContainText('カード表示モードを「コンパクト」に切り替えました。');

    // 詳細表示に戻す
    await page.click('button:has-text("☰ コンパクト")');

    // ログエリアに切替メッセージが表示されることを確認
    await expect(logArea).toContainText('カード表示モードを「詳細」に切り替えました。');
  });
});
