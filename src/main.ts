/**
 * @file main.ts
 * @brief Electronメインプロセスのエントリーポイント。
 * @details
 * アプリケーションウィンドウの生成・イベント管理を行います。
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
 * 
 * ReactDOMとは
 * ReactDOMは、Reactライブラリの一部で、Reactコンポーネントを実際のDOM（Document Object Model）に描画する役割を持っています。
 * 主な用途は、Reactの仮想DOM（Virtual DOM）で定義されたUIを、ブラウザの画面上に表示することです。
 * ReactDOM.createRoot(...) は、React 18以降で導入された新しいAPIで、コンポーネントを"root"要素にマウントします。
 * これにより、Reactの新しい機能（Concurrent Modeなど）が利用可能になります。
 * 
 * React.StrictModeとは
 * React.StrictModeは、Reactの開発モード専用のラッパーコンポーネントです。
 * これで囲まれたコンポーネントは、以下のような追加チェックや警告が有効になります。
 * 非推奨なライフサイクルメソッドの使用検出副作用の二重実行（開発時のみ）、安全でないパターンの警告
 * 本番環境では何も影響しません。主にコード品質向上や将来のReactバージョンへの対応のために使われます。
 */
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);