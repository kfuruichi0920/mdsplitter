/**
 * @file unsavedChanges.ts
 * @brief 未保存の変更に関する共有型定義。
 * @details
 * メインプロセスとレンダラープロセス間で共有される
 * 未保存の変更に関する型定義を提供。
 * @author K.Furuichi
 * @date 2025-11-13
 * @version 0.1
 * @copyright MIT
 */

/**
 * @brief 未保存の変更に対するユーザーのアクション。
 */
export type UnsavedChangesAction = 'discard' | 'apply' | 'cancel';

/**
 * @brief 未保存の変更確認の応答。
 */
export type UnsavedChangesResponse = {
  action: UnsavedChangesAction;
};
