import React, { useEffect, useMemo, useState } from 'react';

import type { ProjectFile, ProjectValidationIssue } from '@/shared/project';
import { PROJECT_FILE_VERSION } from '@/shared/project';
import { useWorkspaceStore } from '@/renderer/store/workspaceStore';
import { useSplitStore } from '@/renderer/store/splitStore';

interface ProjectManagementDialogProps {
  onClose: () => void;
}

interface ProjectListItem {
  name: string;
  selected: boolean;
}

const detectTraceFiles = (files: string[]): string[] =>
  files.filter((file) => /trace|_trace|trace_/.test(file.toLowerCase()));

export const ProjectManagementDialog: React.FC<ProjectManagementDialogProps> = ({ onClose }) => {
  const [cardFiles, setCardFiles] = useState<ProjectListItem[]>([]);
  const [traceFiles, setTraceFiles] = useState<string[]>([]);
  const [name, setName] = useState('新規プロジェクト');
  const [description, setDescription] = useState('');
  const [filePath, setFilePath] = useState('');
  const [loadedProject, setLoadedProject] = useState<ProjectFile | null>(null);
  const [issues, setIssues] = useState<ProjectValidationIssue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      try {
        const outputs = await window.app.workspace.listOutputFiles();
        const traces = detectTraceFiles(outputs);
        setTraceFiles(traces);
        setCardFiles(outputs.map((f) => ({ name: f, selected: true })));
      } catch (error) {
        console.error('[ProjectDialog] failed to list output files', error);
      }
    };
    void fetch();
  }, []);

  const selectedCardFiles = useMemo(() => cardFiles.filter((f) => f.selected).map((f) => f.name), [cardFiles]);

  const buildProject = (): ProjectFile => ({
    version: PROJECT_FILE_VERSION,
    metadata: {
      name,
      description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    files: {
      cardFiles: selectedCardFiles,
      traceFiles,
    },
    settings: {},
  });

  const handleSave = async () => {
    try {
      setLoading(true);
      const project = buildProject();
      let savePath = filePath;
      if (!savePath) {
        const dialogResult = await window.app.dialogs.promptSaveFile({ defaultFileName: `${project.metadata.name || 'project'}.msp` });
        if (dialogResult.canceled || !dialogResult.fileName) {
          setLoading(false);
          return;
        }
        savePath = dialogResult.fileName;
        setFilePath(savePath);
      }
      await window.app.project.save(project, savePath);
      setLoadedProject(project);
    } catch (error) {
      console.error('[ProjectDialog] save failed', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async () => {
    let target = filePath;
    if (!target) {
      const dialogResult = await window.app.dialogs.openProjectFile();
      if (dialogResult.canceled || !dialogResult.filePath) {
        return;
      }
      target = dialogResult.filePath;
      setFilePath(target);
    }
    try {
      setLoading(true);
      const project = await window.app.project.load(target);
      setLoadedProject(project);
      setTraceFiles(project.files.traceFiles);
      setCardFiles(project.files.cardFiles.map((f) => ({ name: f, selected: true })));
      const result = await window.app.project.validate(project);
      setIssues(result.issues);
    } catch (error) {
      console.error('[ProjectDialog] load failed', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    const project = loadedProject ?? buildProject();
    const result = await window.app.project.validate(project);
    setIssues(result.issues);
  };

  const handleBrowse = async () => {
    const dialogResult = await window.app.dialogs.openProjectFile();
    if (!dialogResult.canceled && dialogResult.filePath) {
      setFilePath(dialogResult.filePath);
    }
  };

  const handleRemoveTrace = (file: string) => {
    setTraceFiles((prev) => prev.filter((f) => f !== file));
    setIssues((prev) => prev.filter((i) => i.file !== file && !i.file?.startsWith(`${file}#`)));
  };

  const handleRestoreWorkspace = async () => {
    const project = loadedProject ?? buildProject();
    const store = useWorkspaceStore.getState();
    const split = useSplitStore.getState();
    const leafIds: string[] = [];
    const collect = (node: any) => {
      if (!node) return;
      if (node.type === 'leaf') {
        leafIds.push(node.id);
        return;
      }
      collect(node.first);
      collect(node.second);
    };
    collect(split.root);
    if (leafIds.length === 0) {
      leafIds.push(split.root?.id ?? 'main');
    }

    for (const [index, fileName] of project.files.cardFiles.entries()) {
      try {
        const snapshot = await window.app.workspace.loadOutputFile(fileName);
        if (!snapshot) {
          continue;
        }
        const leafId = leafIds[index % leafIds.length];
        const res = store.openTab(leafId, fileName, snapshot.cards, { savedAt: snapshot.savedAt, title: fileName });
        if (res.status !== 'denied' && res.tabId && index === 0) {
          store.setActiveTab(leafId, res.tabId);
        }
      } catch (error) {
        console.warn('[ProjectDialog] failed to open', fileName, error);
      }
    }
  };

  return (
    <div className="project-dialog" role="dialog" aria-modal="true">
      <div className="project-dialog__backdrop" onClick={onClose} />
      <div className="project-dialog__body">
        <header className="project-dialog__header">
          <h2>プロジェクト管理</h2>
          <button type="button" onClick={onClose} aria-label="閉じる" className="btn-secondary">✕</button>
        </header>
        <div className="project-dialog__grid">
          <section>
            <h3>新規プロジェクト</h3>
            <label className="project-dialog__field">
              <span>プロジェクト名</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="project-dialog__field">
              <span>説明</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
            </label>
            <label className="project-dialog__field">
              <span>.msp 保存先</span>
              <div className="project-dialog__inline">
                <input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="example.msp" />
                <button type="button" className="btn-secondary project-dialog__inline-btn" onClick={handleBrowse}>参照</button>
              </div>
            </label>
            <div className="project-dialog__list">
              <div className="project-dialog__list-head">
                <span>カードファイル</span>
                <button type="button" className="btn-secondary" onClick={() => setCardFiles((prev) => prev.map((p) => ({ ...p, selected: true })))}>
                  全選択
                </button>
              </div>
              <div className="project-dialog__files">
                {cardFiles.map((file) => (
                  <label key={file.name} className="project-dialog__checkbox">
                    <input
                      type="checkbox"
                      checked={file.selected}
                      onChange={() =>
                        setCardFiles((prev) =>
                          prev.map((p) => (p.name === file.name ? { ...p, selected: !p.selected } : p)),
                        )
                      }
                    />
                    <span>{file.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="project-dialog__trace">
              <p className="project-dialog__trace-title">検出トレースファイル</p>
              <ul className="project-dialog__trace-list">
                {traceFiles.map((trace) => (
                  <li key={trace} className="project-dialog__trace-item">
                    <span>{trace}</span>
                    <button type="button" className="btn-secondary btn-compact" onClick={() => handleRemoveTrace(trace)}>除外</button>
                  </li>
                ))}
                {traceFiles.length === 0 ? <li className="project-dialog__trace-empty">なし</li> : null}
              </ul>
            </div>
            <div className="project-dialog__actions">
              <button type="button" className="btn-primary" onClick={handleSave} disabled={loading}>
                {loading ? '保存中…' : '.msp を保存'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleValidate}>
                整合性チェック
              </button>
            </div>
          </section>
          <section>
            <h3>既存プロジェクトを読み込む</h3>
            <label className="project-dialog__field">
              <span>.msp パス</span>
              <div className="project-dialog__inline">
                <input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="project.msp" />
                <button type="button" className="btn-secondary project-dialog__inline-btn" onClick={handleBrowse}>参照</button>
              </div>
            </label>
            <div className="project-dialog__actions">
              <button type="button" className="btn-primary" onClick={handleLoad} disabled={loading || !filePath}>
                {loading ? '読込中…' : '読み込む'}
              </button>
              <button type="button" className="btn-secondary" onClick={handleRestoreWorkspace} disabled={!loadedProject}>
                ワークスペース復元
              </button>
            </div>
            <div className="project-dialog__result">
              <p>読み込み結果: {loadedProject ? loadedProject.metadata.name : '未読込'}</p>
              <ul>
                {issues.map((issue, idx) => (
                  <li key={idx} className={`project-dialog__issue project-dialog__issue--${issue.level}`}>
                    [{issue.level}] {issue.message}{issue.file ? ` (${issue.file})` : ''}
                    {issue.file && issue.file.endsWith('.json') && (
                      <button type="button" className="btn-secondary btn-compact ml-2" onClick={() => handleRemoveTrace(issue.file!)}>除外</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

ProjectManagementDialog.displayName = 'ProjectManagementDialog';
