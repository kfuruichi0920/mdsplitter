/**
 * @file main.tsx
 * @brief Reactアプリケーションのエントリーポイント。
 * @details
 * #root要素にAppコンポーネントをレンダリングします。
 * Vite + React + Electron + TypeScript の開発環境用。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';

/**
 * @brief Reactアプリケーションを#root要素にレンダリングする。
 * @details
 * StrictModeでAppコンポーネントを描画します。
 */
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
