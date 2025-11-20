/**
 * @file global.d.ts
 * @brief レンダラープロセス用のグローバル型定義。
 * @details
 * window.appで公開されるAPI型を宣言。Electron contextBridge経由で利用。
 * 制約: 型定義のみ、実装はpreload.ts参照。@todo API拡張時はここも更新。
 * @author K.Furuichi
 * @date 2025-11-02
 * @version 0.1
 * @copyright MIT
 */
import type { AppSettings, AppSettingsPatch, LogLevel } from '@/shared/settings';
import type { WorkspaceSnapshot } from '@/shared/workspace';
import type { LoadedTraceabilityFile, TraceFileSaveRequest, TraceFileSaveResult } from '@/shared/traceability';
import type { AppendCardHistoryRequest, CardHistory } from '@/shared/history';
import type { DocumentLoadErrorCode } from '@/main/documentLoader';
import type {
	CardSelectionChangeEvent,
	MatrixCloseRequest,
	MatrixCloseResult,
	MatrixExportRequest,
	MatrixExportResult,
	MatrixInitPayload,
	MatrixOpenRequest,
	MatrixOpenResult,
	TraceChangeEvent,
} from '@/shared/matrixProtocol';
import type { ExportFormat, ExportOptions } from '@/shared/export';
import type { Card } from '@/shared/workspace';

export { };

declare global {
	interface Window {
		app: {
			ping: (message: string) => Promise<{ ok: boolean; timestamp: number }>;
			settings: {
				load: () => Promise<AppSettings>;
				update: (patch: AppSettingsPatch) => Promise<AppSettings>;
			};
			log: (level: LogLevel, message: string) => Promise<void>;
			workspace: {
				save: (snapshot: WorkspaceSnapshot) => Promise<{ path: string }>;
				saveCardFile: (fileName: string, snapshot: WorkspaceSnapshot) => Promise<{ path: string }>;
				saveTraceFile: (payload: TraceFileSaveRequest) => Promise<TraceFileSaveResult>;
				load: () => Promise<WorkspaceSnapshot | null>;
				listCardFiles: () => Promise<string[]>;
				listOutputFiles: () => Promise<string[]>;
				loadCardFile: (fileName: string) => Promise<WorkspaceSnapshot | null>;
				loadOutputFile: (fileName: string) => Promise<WorkspaceSnapshot | null>;
				loadTraceFile: (leftFile: string, rightFile: string) => Promise<LoadedTraceabilityFile | null>;
			};
			dialogs: {
				promptSaveFile: (options?: { defaultFileName?: string }) => Promise<{ canceled: boolean; fileName?: string }>;
			};
			document: {
				pickSource: () => Promise<
					| { canceled: true }
					| {
						canceled: false;
						document: {
							fileName: string;
							baseName: string;
							extension: string;
							sizeBytes: number;
							encoding: string;
							content: string;
							isMarkdown: boolean;
							sizeStatus: 'ok' | 'warn';
							workspaceFileName: string | null;
							workspacePath: string | null;
						};
					}
					| {
						canceled: false;
						error: { message: string; code: DocumentLoadErrorCode | 'READ_FAILED' };
					}
				>;
			};
			history: {
				load: (fileName: string, cardId: string) => Promise<CardHistory>;
				appendVersion: (payload: AppendCardHistoryRequest) => Promise<CardHistory>;
			};
			matrix: {
				open: (payload: MatrixOpenRequest) => Promise<MatrixOpenResult>;
				close: (payload: MatrixCloseRequest) => Promise<MatrixCloseResult>;
				onInit: (callback: (payload: MatrixInitPayload) => void) => () => void;
				onTraceChanged: (callback: (event: TraceChangeEvent) => void) => () => void;
				onCardSelectionChanged: (callback: (event: CardSelectionChangeEvent) => void) => () => void;
				broadcastTraceChange: (event: TraceChangeEvent) => void;
				broadcastCardSelection: (event: CardSelectionChangeEvent) => void;
				export: (payload: MatrixExportRequest) => Promise<MatrixExportResult>;
			};
			export: {
				exportCards: (format: ExportFormat, options: ExportOptions, cards: Card[]) => Promise<boolean>;
			};
		};
	}
}
