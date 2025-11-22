import http from 'node:http';
import { URL } from 'node:url';
import { nanoid } from 'nanoid';
import type { BrowserWindow } from 'electron';

import { listCardFiles, loadCardFile } from './workspace';
import { runSearch, type SearchDataset, type SearchRequest, type SearchResult } from '../shared/search';

type OpenTabsSnapshot = {
  tabs: SearchDataset[];
  activeTabId?: string | null;
  activeLeafId?: string | null;
};

type SearchHistoryEntry = {
  request: SearchRequest;
  results: SearchResult[];
  createdAt: number;
};

type ServerState = {
  server: http.Server | null;
  port: number | null;
  history: SearchHistoryEntry[];
  openTabs: OpenTabsSnapshot | null;
};

const state: ServerState = {
  server: null,
  port: null,
  history: [],
  openTabs: null,
};

const readBody = async (req: http.IncomingMessage): Promise<any> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return null;
  }
  const raw = Buffer.concat(chunks).toString('utf-8');
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
};

const sendJson = (res: http.ServerResponse, status: number, payload: unknown): void => {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': 'http://127.0.0.1',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
};

const notFound = (res: http.ServerResponse) => sendJson(res, 404, { error: 'not found' });

const handleOptions = (res: http.ServerResponse) => {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': 'http://127.0.0.1',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
};

let getMainWindow: () => BrowserWindow | null = () => null;

export const setMainWindowResolver = (resolver: () => BrowserWindow | null): void => {
  getMainWindow = resolver;
};

const buildSearchPage = (port: number): string => `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>Search</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 16px; }
    h1 { margin-top: 0; }
    label { display:block; margin:8px 0 4px; font-weight:600; }
    input, select, textarea, button { width:100%; padding:8px; margin-bottom:8px; }
    .results { border:1px solid #ddd; padding:8px; max-height:300px; overflow:auto; }
    .result { padding:6px; border-bottom:1px solid #eee; cursor:pointer; }
    .meta { color:#666; font-size:12px; }
  </style>
</head>
<body>
  <h1>検索</h1>
  <form id="search-form">
    <label>キーワード</label>
    <input id="keyword" type="text" placeholder="検索キーワード" />
    <label>モード</label>
    <select id="mode">
      <option value="text">キーワード</option>
      <option value="regex">正規表現</option>
      <option value="id">ID</option>
      <option value="trace">トレース</option>
      <option value="advanced">高度(AND)</option>
    </select>
    <label>範囲</label>
    <select id="scope">
      <option value="current">アクティブタブ</option>
      <option value="open">開いているタブ</option>
      <option value="input">_input</option>
    </select>
    <button type="submit">検索</button>
  </form>
  <div class="results" id="results"></div>
  <script>
    const render = (items) => {
      const container = document.getElementById('results');
      container.innerHTML = '';
      items.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'result';
        div.innerHTML = '<div class="meta">' + item.fileName + ' (' + item.matchCount + ')</div><div>' + item.cardTitle + '</div><div class="meta">' + item.snippet + '</div>';
        div.onclick = async () => {
          await fetch('http://127.0.0.1:${port}/api/focus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: item.fileName, cardId: item.cardId, tabId: item.tabId }) });
        };
        container.appendChild(div);
      });
    };
    document.getElementById('search-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        scope: document.getElementById('scope').value,
        mode: document.getElementById('mode').value,
        text: document.getElementById('keyword').value,
      };
      const res = await fetch('http://127.0.0.1:${port}/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      render(data.results ?? []);
    });
  </script>
</body>
</html>`;

const handler = (req: http.IncomingMessage, res: http.ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${state.port ?? 0}`);
  if (req.method === 'OPTIONS') {
    handleOptions(res);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, port: state.port });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/search/history') {
    sendJson(res, 200, state.history);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/search') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(buildSearchPage(state.port ?? 0));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/workspace/tabs') {
    return void readBody(req).then((body) => {
      if (!body || !Array.isArray(body.tabs)) {
        sendJson(res, 400, { error: 'tabs missing' });
        return;
      }
      state.openTabs = {
        tabs: body.tabs,
        activeLeafId: body.activeLeafId ?? null,
        activeTabId: body.activeTabId ?? null,
      };
      sendJson(res, 200, { ok: true });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/search/history') {
    return void readBody(req).then((body) => {
      if (!body || !body.request || !Array.isArray(body.results)) {
        sendJson(res, 400, { error: 'invalid history payload' });
        return;
      }
      state.history.unshift({ request: body.request, results: body.results, createdAt: Date.now() });
      sendJson(res, 200, { ok: true });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/search') {
    return void readBody(req).then(async (body) => {
      const request = body as SearchRequest;
      if (!request || typeof request !== 'object' || !request.scope || !request.mode) {
        sendJson(res, 400, { error: 'invalid request' });
        return;
      }

      const datasets: SearchDataset[] = [];
      if (request.scope === 'open' || request.scope === 'current') {
        if (!state.openTabs?.tabs?.length) {
          sendJson(res, 400, { error: '開いているタブ情報がありません。メイン画面から検索を再度実行してください。' });
          return;
        }
        if (request.scope === 'current') {
          const target = state.openTabs.tabs.find((tab) => tab.tabId === state.openTabs?.activeTabId) ?? null;
          if (!target) {
            sendJson(res, 400, { error: 'アクティブタブ情報がありません。' });
            return;
          }
          datasets.push(target);
        } else {
          datasets.push(...state.openTabs.tabs);
        }
      } else if (request.scope === 'input') {
        const files = await listCardFiles();
        for (const file of files) {
          const snapshot = await loadCardFile(file);
          if (snapshot?.cards) {
            datasets.push({ source: 'input', fileName: file, cards: snapshot.cards });
          }
        }
      } else {
        sendJson(res, 400, { error: 'unsupported scope' });
        return;
      }

      const result = await runSearch({ ...request, id: request.id ?? nanoid() }, datasets);
      const entry: SearchHistoryEntry = {
        request: { ...request, id: request.id ?? nanoid() },
        results: result.results,
        createdAt: Date.now(),
      };
      state.history.unshift(entry);
      sendJson(res, 200, { ...result, requestId: entry.request.id });
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/focus') {
    return void readBody(req).then((body) => {
      const payload = body ?? {};
      if (typeof payload.fileName !== 'string' || typeof payload.cardId !== 'string') {
        sendJson(res, 400, { error: 'invalid focus payload' });
        return;
      }
      const win = getMainWindow();
      win?.webContents.send('search:focus', payload);
      sendJson(res, 200, { ok: true });
    });
  }

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(302, { Location: '/search' });
    res.end();
    return;
  }

  notFound(res);
};

export const startSearchServer = async (): Promise<number> => {
  if (state.server && state.port) {
    return state.port;
  }
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (typeof address === 'object' && address && typeof address.port === 'number') {
    state.port = address.port;
  } else {
    throw new Error('Failed to start search server');
  }
  state.server = server;
  return state.port;
};

export const getSearchServerPort = (): number | null => state.port;

export const updateOpenTabsSnapshot = (snapshot: OpenTabsSnapshot): void => {
  state.openTabs = snapshot;
};
