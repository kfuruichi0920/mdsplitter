import React from 'react';
import { createRoot } from 'react-dom/client';
import { SearchApp } from './SearchApp';
import '../styles.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<SearchApp />);
}
