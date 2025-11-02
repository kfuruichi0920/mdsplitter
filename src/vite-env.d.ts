/**
 * @file vite-env.d.ts
 * @brief Vite環境用型定義ファイル。
 * @details
 * Vite固有の型補完を提供します。
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
