/**
 * @file App.tsx
 * @brief mdsplitterアプリケーションのメインUIコンポーネント。
 * @details
 * メインプロセスとのハンドシェイクを行い、状態・時刻を表示します。
 * Vite + React + Electron + TypeScript の開発環境用サンプル。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */

import { useEffect, useState } from 'react';

import './styles.css';

/**
 * @brief アプリケーションのメインコンポーネント。
 * @details
 * 起動時にメインプロセスとハンドシェイクし、状態・時刻を表示します。
 * @return JSX要素
 */
export const App = () => {
  const [status, setStatus] = useState('起動準備中...'); ///< 現在の状態メッセージ
  const [timestamp, setTimestamp] = useState<number | null>(null); ///< ハンドシェイク時刻

  useEffect(() => {
    /**
     * @brief メインプロセスとのハンドシェイク処理。
     * @details
     * window.app.ping('renderer-ready') を呼び出し、結果を状態に反映します。
     * @throws エラー時は状態メッセージを更新し、コンソールに出力します。
     */
    const bootstrap = async () => {
      try {
        setStatus('ハンドシェイク送信中...'); //! 状態: ハンドシェイク開始
        const result = await window.app.ping('renderer-ready'); //! メインプロセスへping
        setTimestamp(result.timestamp); //! ハンドシェイク時刻を保存
        setStatus('メインプロセスと接続済み'); //! 状態: 接続成功
      } catch (error) {
        console.error('[renderer] handshake failed', error); //! エラー出力
        setStatus('メインプロセスとの接続に失敗しました'); //! 状態: 接続失敗
      }
    };

    bootstrap(); //! 初回のみ実行
  }, []);

  return (
    <main className="app">
      <h1>mdsplitter (Skeleton)</h1>
      <section>
        <p className="status">現在の状態: {status}</p>
        {timestamp && <p className="timestamp">ハンドシェイク時刻: {new Date(timestamp).toLocaleString()}</p>}
        <p className="hint">Vite + React + Electron + TypeScript の開発環境が起動しています。</p>
      </section>
    </main>
  );
};
