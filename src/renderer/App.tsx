import { useEffect, useState } from 'react';

import './styles.css';

export const App = () => {
  const [status, setStatus] = useState('起動準備中...');
  const [timestamp, setTimestamp] = useState<number | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setStatus('ハンドシェイク送信中...');
        const result = await window.app.ping('renderer-ready');
        setTimestamp(result.timestamp);
        setStatus('メインプロセスと接続済み');
      } catch (error) {
        console.error('[renderer] handshake failed', error);
        setStatus('メインプロセスとの接続に失敗しました');
      }
    };

    bootstrap();
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
