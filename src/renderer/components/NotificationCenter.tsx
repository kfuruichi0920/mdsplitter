import { useNotificationStore } from '../store/notificationStore';

const levelClassNames: Record<string, string> = {
  info: 'border-blue-400 bg-blue-500/20 text-blue-100',
  success: 'border-emerald-400 bg-emerald-500/20 text-emerald-100',
  warning: 'border-amber-400 bg-amber-500/20 text-amber-100',
  error: 'border-rose-400 bg-rose-500/20 text-rose-100',
};

/**
 * @brief 通知センターコンポーネント。
 * @details
 * 状態管理ストアから通知一覧を取得し、各通知を表示。閉じるボタンで個別削除。
 */
export const NotificationCenter = () => {
  //! 通知一覧・削除関数を取得
  const items = useNotificationStore((state) => state.items);
  const remove = useNotificationStore((state) => state.remove);

  //! 通知がなければ何も表示しない
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="notification-center" role="region" aria-live="polite">
      {items.map((item) => (
        <div key={item.id} className={`notification ${levelClassNames[item.level] ?? levelClassNames.info}`}>
          <span className="notification__message">{item.message}</span>
          <button type="button" className="notification__close" onClick={() => remove(item.id)} aria-label="通知を閉じる">
            ×
          </button>
        </div>
      ))}
    </div>
  );
};
