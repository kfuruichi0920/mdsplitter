import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { ProjectFile, ProjectValidationIssue, ProjectValidationResult } from '../shared/project';
import { isProjectFile, PROJECT_FILE_VERSION } from '../shared/project';
import { isWorkspaceSnapshot } from '../shared/workspace';
import { getWorkspacePaths } from './workspace';

const readJsonFile = async (filePath: string): Promise<unknown> => {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

export const loadProjectFile = async (filePath: string): Promise<ProjectFile> => {
  const payload = await readJsonFile(filePath);
  if (!isProjectFile(payload)) {
    throw new Error('プロジェクトファイルの形式が不正です');
  }
  return payload;
};

export const saveProjectFile = async (project: ProjectFile, filePath: string): Promise<{ path: string }> => {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const normalized: ProjectFile = {
    ...project,
    version: project.version || PROJECT_FILE_VERSION,
    metadata: {
      ...project.metadata,
      updatedAt: new Date().toISOString(),
    },
  };
  await fs.writeFile(filePath, JSON.stringify(normalized, null, 2), 'utf8');
  return { path: filePath };
};

export const validateTraceConsistency = async (project: ProjectFile): Promise<ProjectValidationResult> => {
  const paths = getWorkspacePaths();
  const issues: ProjectValidationIssue[] = [];

  const cardIdCache = new Map<string, Set<string>>();

  const resolveCardIds = async (cardFile: string): Promise<Set<string> | null> => {
    if (cardIdCache.has(cardFile)) {
      return cardIdCache.get(cardFile) ?? null;
    }
    const target = path.join(paths.outputDir, cardFile);
    try {
      const raw = await fs.readFile(target, 'utf8');
      const parsed = JSON.parse(raw);
      let cards: any[] | undefined;
      if (isWorkspaceSnapshot(parsed)) {
        cards = parsed.cards;
      } else if (Array.isArray(parsed.cards)) {
        cards = parsed.cards;
      }
      if (!cards) {
        issues.push({ level: 'warn', message: 'カード配列を解釈できません', file: cardFile });
        cardIdCache.set(cardFile, null as unknown as Set<string>);
        return null;
      }
      const ids = new Set<string>(cards.map((c) => c.cardId ?? c.id).filter(Boolean));
      cardIdCache.set(cardFile, ids);
      return ids;
    } catch {
      issues.push({ level: 'error', message: 'カードファイルを読み込めません', file: cardFile });
      cardIdCache.set(cardFile, null as unknown as Set<string>);
      return null;
    }
  };

  for (const cardFile of project.files.cardFiles) {
    const target = path.join(paths.outputDir, cardFile);
    try {
      await fs.access(target);
    } catch {
      issues.push({ level: 'error', message: 'カードファイルが存在しません', file: cardFile });
    }
  }

  for (const traceFile of project.files.traceFiles) {
    const target = path.join(paths.outputDir, traceFile);
    let parsed: any;
    try {
      const raw = await fs.readFile(target, 'utf8');
      parsed = JSON.parse(raw);
    } catch {
      issues.push({ level: 'error', message: 'トレースファイルを読み込めません', file: traceFile });
      continue;
    }
    const left = parsed?.payload?.left_file;
    const right = parsed?.payload?.right_file;
    if (!project.files.cardFiles.includes(left)) {
      issues.push({ level: 'error', message: 'left_file がプロジェクトに含まれていません', file: traceFile });
    }
    if (!project.files.cardFiles.includes(right)) {
      issues.push({ level: 'error', message: 'right_file がプロジェクトに含まれていません', file: traceFile });
    }

    const leftIds = left ? await resolveCardIds(left) : null;
    const rightIds = right ? await resolveCardIds(right) : null;

    const relations: any[] = parsed?.payload?.relations ?? [];
    relations.forEach((rel, idx) => {
      const lMissing = Array.isArray(rel.left_ids)
        ? rel.left_ids.filter((id: string) => !leftIds?.has(id))
        : [];
      const rMissing = Array.isArray(rel.right_ids)
        ? rel.right_ids.filter((id: string) => !rightIds?.has(id))
        : [];
      if (lMissing.length > 0) {
        issues.push({ level: 'error', message: `left_ids に存在しないカード: ${lMissing.join(', ')}`, file: `${traceFile}#${idx}` });
      }
      if (rMissing.length > 0) {
        issues.push({ level: 'error', message: `right_ids に存在しないカード: ${rMissing.join(', ')}`, file: `${traceFile}#${idx}` });
      }
    });
  }

  return { ok: issues.every((i) => i.level !== 'error'), issues } satisfies ProjectValidationResult;
};
