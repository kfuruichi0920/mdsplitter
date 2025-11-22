import http from 'node:http';
import { URL } from 'node:url';
import { nanoid } from 'nanoid';
import type { BrowserWindow } from 'electron';

import { listCardFiles, loadCardFile, listOutputFiles, loadOutputFile, getWorkspacePaths } from './workspace';
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
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(payload));
};

const notFound = (res: http.ServerResponse) => sendJson(res, 404, { error: 'not found' });

const handleOptions = (res: http.ServerResponse) => {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end();
};

let getMainWindow: () => BrowserWindow | null = () => null;

export const setMainWindowResolver = (resolver: () => BrowserWindow | null): void => {
  getMainWindow = resolver;
};

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
      console.info(`[searchServer] search scope=${request.scope}, mode=${request.mode}`);
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
        // 仕様変更: 検索対象は _out 配下のカードファイル
        const paths = getWorkspacePaths();
        console.info(`[searchServer] _output dir: ${paths.outputDir}`);
        const files = await listOutputFiles();
        console.info(`[searchServer] _output files found: ${files.length}`);
        for (const file of files) {
          try {
            const snapshot = await loadOutputFile(file);
            if (snapshot?.cards) {
              datasets.push({ source: 'input', fileName: file, cards: snapshot.cards });
            }
          } catch (error) {
            console.error('[searchServer] failed to load card file from _output', file, error);
          }
        }
        if (datasets.length === 0) {
          sendJson(res, 400, { error: `_output に検索対象のカードファイルがありません。dir=${paths.outputDir}` });
          return;
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

  notFound(res);
};

export const startSearchServer = async (): Promise<number> => {
  if (state.server && state.port) {
    console.info(`[searchServer] already running on port ${state.port}`);
    return state.port;
  }
  const attemptStart = async (attempt: number): Promise<number> => {
    return await new Promise<number>((resolve, reject) => {
      const server = http.createServer(handler);
      server.on('error', (err: NodeJS.ErrnoException) => {
        console.error(`[searchServer] error on start (attempt ${attempt}):`, err);
        if (err.code === 'EADDRINUSE') {
          server.close(() => {
            if (attempt < 5) {
              setTimeout(() => {
                attemptStart(attempt + 1).then(resolve).catch(reject);
              }, 50 * attempt);
            } else {
              reject(new Error('検索サーバのポートを確保できません (EADDRINUSE)'));
            }
          });
        } else {
          reject(err);
        }
      });

      server.listen(0, '127.0.0.1', () => {
        const address = server.address();
        if (typeof address === 'object' && address && typeof address.port === 'number') {
          state.port = address.port;
          state.server = server;
          console.info(`[searchServer] started on port ${state.port}`);
          resolve(address.port);
        } else {
          reject(new Error('Failed to resolve search server address'));
        }
      });
    });
  };

  return attemptStart(1);
};

export const getSearchServerPort = (): number | null => state.port;

export const updateOpenTabsSnapshot = (snapshot: OpenTabsSnapshot): void => {
  state.openTabs = snapshot;
};
