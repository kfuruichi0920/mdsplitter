/**
 * @file UnsavedChangesDialog.tsx
 * @brief 未保存の変更がある場合のユーザー確認ダイアログ。
 * @details
 * アプリケーションのクローズ時に未保存の編集ファイルがある場合に表示され、
 * ユーザーに変更の破棄、適用、またはキャンセルの選択を求める。
 * @author K.Furuichi
 * @date 2025-11-13
 * @version 0.1
 * @copyright MIT
 */

import type { UnsavedChangesAction } from '@/shared/unsavedChanges';

export type { UnsavedChangesAction };

export interface UnsavedChangesDialogProps {
  /**
   * @brief ダイアログの表示状態。
   */
  isOpen: boolean;

  /**
   * @brief 未保存のタブの数。
   */
  unsavedTabCount: number;

  /**
   * @brief 保存中かどうか。
   */
  isSaving: boolean;

  /**
   * @brief ユーザーがアクションを選択した際のコールバック。
   * @param action ユーザーが選択したアクション ('discard' | 'apply' | 'cancel')
   */
  onAction: (action: UnsavedChangesAction) => void;
}

/**
 * @brief 未保存の変更確認ダイアログコンポーネント。
 * @details
 * 3つのボタンを表示：
 * - 「全ての変更を破棄する」: 未保存の変更を破棄してアプリを終了
 * - 「全ての変更を適用する」: 未保存の変更を保存してアプリを終了
 * - 「キャンセル」: アプリの終了をキャンセル
 * @param props ダイアログのプロパティ
 * @return ダイアログコンポーネント（非表示の場合はnull）
 */
export const UnsavedChangesDialog = ({
  isOpen,
  unsavedTabCount,
  isSaving,
  onAction,
}: UnsavedChangesDialogProps) => {
  if (!isOpen) {
    return null;
  }

  const handleDiscard = () => {
    if (!isSaving) {
      onAction('discard');
    }
  };

  const handleApply = () => {
    if (!isSaving) {
      onAction('apply');
    }
  };

  const handleCancel = () => {
    if (!isSaving) {
      onAction('cancel');
    }
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content unsaved-changes-dialog" onClick={(e) => e.stopPropagation()}>
        {/* ダイアログヘッダー */}
        <div className="modal-header">
          <h2 className="modal-title">未保存の変更があります</h2>
        </div>

        {/* ダイアログ本文 */}
        <div className="modal-body">
          <p className="unsaved-changes-dialog__message">
            {unsavedTabCount === 1
              ? '1件の編集ファイルが保存されていません。'
              : `${unsavedTabCount}件の編集ファイルが保存されていません。`}
          </p>
          <p className="unsaved-changes-dialog__question">
            アプリケーションを終了する前に、これらの変更をどうしますか？
          </p>
        </div>

        {/* ダイアログフッター（ボタン群） */}
        <div className="modal-footer unsaved-changes-dialog__actions">
          <button
            type="button"
            className="btn btn--danger"
            onClick={handleDiscard}
            disabled={isSaving}
            aria-label="全ての変更を破棄してアプリを終了"
          >
            全ての変更を破棄する
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleApply}
            disabled={isSaving}
            aria-label="全ての変更を保存してアプリを終了"
          >
            {isSaving ? '保存中...' : '全ての変更を適用する'}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={handleCancel}
            disabled={isSaving}
            aria-label="アプリの終了をキャンセル"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};
