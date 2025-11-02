/**
 * @file global.d.ts
 * @brief グローバル型定義ファイル。
 * @details
 * プロジェクト全体で利用する型・インターフェースを宣言します。
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