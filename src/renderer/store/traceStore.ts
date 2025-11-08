
/**
 * @file traceStore.ts
 * @brief トレーサビリティリンクのキャッシュ・取得を管理するZustandストア。
 * @details
 * ファイルペアごとにトレース情報をキャッシュし、UIからの要求に応じてロード・エラー管理を行う。
 * @author K.Furuichi
 * @date 2025-11-06
 * @version 0.1
 * @copyright MIT
 */
import { create } from 'zustand';
import type {
  LoadedTraceabilityFile,
  TraceabilityHeader,
  TraceabilityLink,
  TraceabilityRelation,
} from '@/shared/traceability';
import { TRACEABILITY_FILE_SCHEMA_VERSION, relationsToLinks } from '@/shared/traceability';


/**
 * @brief トレースキャッシュ1件分の情報。
 * @details
 * ファイルペアごとに状態・リンク・エラー等を保持。
 */
export interface TraceSeed {
  fileName: string;
  cardId: string;
}

interface TraceCacheEntry {
  key: string; ///< キャッシュキー（left|||right）
  status: 'idle' | 'loading' | 'ready' | 'missing' | 'error'; ///< 現在の状態。
  timestamp: number; ///< 最終更新時刻。
  links: TraceabilityLink[]; ///< トレーサビリティリンク配列。
  relations: TraceabilityRelation[]; ///< 元となるrelation配列。
  header?: TraceabilityHeader; ///< ファイルヘッダ。
  schemaVersion?: number; ///< スキーマバージョン。
  leftFile: string; ///< 左側ファイル名（UI基準）。
  rightFile: string; ///< 右側ファイル名（UI基準）。
  sourceFileName?: string; ///< ソースファイル名。
  fileName?: string; ///< 実際のファイル名。
  error?: string; ///< エラー内容（失敗時のみ）。
  counts: {
    left: Record<string, number>;
    right: Record<string, number>;
  };
}

const NODE_DELIMITER = '::';

export const toTraceNodeKey = (fileName: string, cardId: string): string => `${fileName}${NODE_DELIMITER}${cardId}`;

export const splitTraceNodeKey = (key: string): { fileName: string; cardId: string } => {
  const index = key.indexOf(NODE_DELIMITER);
  if (index === -1) {
    return { fileName: '', cardId: key };
  }
  return { fileName: key.slice(0, index), cardId: key.slice(index + NODE_DELIMITER.length) };
};


/**
 * @brief トレースストアの状態・アクション定義。
 */
interface TraceState {
  cache: Record<string, TraceCacheEntry>; ///< ファイルペアごとのキャッシュ。
  loadTraceForPair: (leftFile: string, rightFile: string) => Promise<TraceCacheEntry>; ///< トレースファイルをロード。
  getCached: (leftFile: string, rightFile: string) => TraceCacheEntry | undefined; ///< キャッシュ取得。
  saveRelationsForPair: (params: {
    leftFile: string;
    rightFile: string;
    relations: TraceabilityRelation[];
  }) => Promise<TraceCacheEntry>;
  getCountsForFile: (fileName: string) => { left: Record<string, number>; right: Record<string, number> };
  getRelatedCards: (seeds: TraceSeed[]) => Record<string, Set<string>>;
  getRelatedNodeKeys: (seeds: TraceSeed[]) => Set<string>;
}


/**
 * @brief ファイルペアからキャッシュキーを生成。
 * @param leftFile 左側ファイル名。
 * @param rightFile 右側ファイル名。
 * @return キャッシュキー文字列。
 */
const toKey = (leftFile: string, rightFile: string): string => `${leftFile}|||${rightFile}`;


/**
 * @brief ロード済みトレースファイルをキャッシュエントリへ変換。
 * @param leftFile 左側ファイル名。
 * @param rightFile 右側ファイル名。
 * @param file ロード済みトレースファイル。
 * @return キャッシュエントリ。
 */
const convertLoadedFile = (
  leftFile: string,
  rightFile: string,
  file: LoadedTraceabilityFile,
): TraceCacheEntry => {
  const isSwapped = !(file.payload.left_file === leftFile && file.payload.right_file === rightFile);
  const links = relationsToLinks(file.payload.relations, { swapOrientation: isSwapped });
  const counts = {
    left: {} as Record<string, number>,
    right: {} as Record<string, number>,
  };

  links.forEach((link) => {
    counts.left[link.sourceCardId] = (counts.left[link.sourceCardId] ?? 0) + 1;
    counts.right[link.targetCardId] = (counts.right[link.targetCardId] ?? 0) + 1;
  });

  const relations = file.payload.relations.map((relation) => ({
    ...relation,
    left_ids: [...relation.left_ids],
    right_ids: [...relation.right_ids],
  }));

  return {
    key: toKey(leftFile, rightFile),
    status: 'ready',
    timestamp: Date.now(),
    links,
    relations,
    schemaVersion: file.payload.schemaVersion,
    header: file.payload.header,
    leftFile,
    rightFile,
    sourceFileName: file.fileName,
    fileName: file.fileName,
    counts,
  } satisfies TraceCacheEntry;
};

const mergeCounts = (target: Record<string, number>, source: Record<string, number>): void => {
  Object.entries(source).forEach(([cardId, count]) => {
    target[cardId] = (target[cardId] ?? 0) + count;
  });
};

const buildAdjacency = (cache: Record<string, TraceCacheEntry>): Map<string, Set<string>> => {
  const adjacency = new Map<string, Set<string>>();
  const addEdge = (a: string, b: string) => {
    if (!adjacency.has(a)) {
      adjacency.set(a, new Set<string>());
    }
    adjacency.get(a)?.add(b);
  };

  Object.values(cache).forEach((entry) => {
    entry.relations.forEach((relation) => {
      relation.left_ids.forEach((leftId) => {
        relation.right_ids.forEach((rightId) => {
          const leftKey = toTraceNodeKey(entry.leftFile, leftId);
          const rightKey = toTraceNodeKey(entry.rightFile, rightId);
          addEdge(leftKey, rightKey);
          addEdge(rightKey, leftKey);
        });
      });
    });
  });

  return adjacency;
};

const collectRelatedNodeKeys = (cache: Record<string, TraceCacheEntry>, seeds: TraceSeed[]): Set<string> => {
  const adjacency = buildAdjacency(cache);
  const visited = new Set<string>();
  const queue: string[] = [];
  const seedMap = new Map<string, Set<string>>();

  seeds.forEach(({ fileName, cardId }) => {
    if (!seedMap.has(fileName)) {
      seedMap.set(fileName, new Set<string>());
    }
    seedMap.get(fileName)?.add(cardId);
    const key = toTraceNodeKey(fileName, cardId);
    if (!visited.has(key)) {
      visited.add(key);
      queue.push(key);
    }
  });

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const neighbors = adjacency.get(current);
    if (!neighbors) {
      continue;
    }
    neighbors.forEach((neighbor) => {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    });
  }

  const filtered = new Set<string>();
  visited.forEach((nodeKey) => {
    const { fileName, cardId } = splitTraceNodeKey(nodeKey);
    const seedsForFile = fileName ? seedMap.get(fileName) : undefined;
    if (seedsForFile) {
      if (seedsForFile.has(cardId)) {
        filtered.add(nodeKey);
      }
    } else {
      filtered.add(nodeKey);
    }
  });

  return filtered;
};

export const aggregateCountsForFile = (
  cache: Record<string, TraceCacheEntry>,
  fileName: string,
): { left: Record<string, number>; right: Record<string, number> } => {
  const aggregated = { left: {} as Record<string, number>, right: {} as Record<string, number> };
  if (!fileName) {
    return aggregated;
  }

  Object.values(cache).forEach((entry) => {
    if (entry.leftFile === fileName) {
      mergeCounts(aggregated.right, entry.counts.left);
    }
    if (entry.rightFile === fileName) {
      mergeCounts(aggregated.left, entry.counts.right);
    }
  });

  return aggregated;
};


/**
 * @brief トレースストア本体。
 * @details
 * ファイルペアごとにキャッシュ管理・ロード・エラー処理を行う。
 */
export const useTraceStore = create<TraceState>()((set, get) => ({
  cache: {},
  getCached: (leftFile, rightFile) => {
    const key = toKey(leftFile, rightFile);
    return get().cache[key];
  },
  getCountsForFile: (fileName) => {
    if (!fileName) {
      return { left: {}, right: {} };
    }
    return aggregateCountsForFile(get().cache, fileName);
  },
  getRelatedNodeKeys: (seeds) => {
    if (!seeds || seeds.length === 0) {
      return new Set<string>();
    }
    return collectRelatedNodeKeys(get().cache, seeds);
  },
  getRelatedCards: (seeds) => {
    if (!seeds || seeds.length === 0) {
      return {};
    }
    const nodeKeys = collectRelatedNodeKeys(get().cache, seeds);
    const result: Record<string, Set<string>> = {};
    nodeKeys.forEach((nodeKey) => {
      const { fileName, cardId } = splitTraceNodeKey(nodeKey);
      if (!fileName) {
        return;
      }
      if (!result[fileName]) {
        result[fileName] = new Set<string>();
      }
      result[fileName]?.add(cardId);
    });
    return result;
  },
  loadTraceForPair: async (leftFile, rightFile) => {
    const key = toKey(leftFile, rightFile);
    const cached = get().cache[key];
    if (cached && (cached.status === 'ready' || cached.status === 'missing')) {
      return cached;
    }

    set((state) => ({
      cache: {
        ...state.cache,
        [key]: {
          key,
          status: 'loading',
          timestamp: Date.now(),
          links: [],
          relations: [],
          leftFile,
          rightFile,
          counts: { left: {}, right: {} },
        },
      },
    }));

    try {
      const result = await window.app.workspace.loadTraceFile(leftFile, rightFile);
      if (!result) {
        const entry: TraceCacheEntry = {
          key,
          status: 'missing',
          timestamp: Date.now(),
          links: [],
          relations: [],
          leftFile,
          rightFile,
          counts: { left: {}, right: {} },
        };
        set((state) => ({ cache: { ...state.cache, [key]: entry } }));
        if (window.app?.log) {
          void window.app.log('info', `Trace file not found for pair: ${leftFile} / ${rightFile}`);
        }
        return entry;
      }
      const entry = convertLoadedFile(leftFile, rightFile, result);
      set((state) => ({ cache: { ...state.cache, [key]: entry } }));
      if (window.app?.log) {
        void window.app.log('info', `Trace file loaded: ${result.fileName}`);
      }
      return entry;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      const entry: TraceCacheEntry = {
        key,
        status: 'error',
        timestamp: Date.now(),
        links: [],
        relations: [],
        leftFile,
        rightFile,
        error: message,
        counts: { left: {}, right: {} },
      };
      set((state) => ({ cache: { ...state.cache, [key]: entry } }));
      if (window.app?.log) {
        void window.app.log('error', `Trace file load failed for pair ${leftFile} / ${rightFile}: ${message}`);
      }
      return entry;
    }
  },
  saveRelationsForPair: async ({ leftFile, rightFile, relations }) => {
    const key = toKey(leftFile, rightFile);
    const cached = get().cache[key];
    const payload = {
      fileName: cached?.fileName ?? cached?.sourceFileName,
      header: cached?.header,
    };

    const result = await window.app.workspace.saveTraceFile({
      fileName: payload.fileName,
      leftFile,
      rightFile,
      relations,
      header: payload.header,
    });

    const loaded: LoadedTraceabilityFile = {
      fileName: result.fileName,
      payload: {
        schemaVersion: TRACEABILITY_FILE_SCHEMA_VERSION,
        header: result.header,
        left_file: leftFile,
        right_file: rightFile,
        relations,
      },
    };

    const entry = convertLoadedFile(leftFile, rightFile, loaded);
    set((state) => ({ cache: { ...state.cache, [key]: entry } }));
    return entry;
  },
}));


/**
 * @brief ストアのキャッシュを初期化。
 */
export const resetTraceStore = (): void => {
  useTraceStore.setState({ cache: {} });
};
