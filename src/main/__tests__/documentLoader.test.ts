/** @jest-environment node */

import path from 'node:path';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';

import { defaultSettings } from '@/shared/settings';
import type { AppSettings } from '@/shared/settings';
import {
  BYTES_PER_MB,
  DocumentLoadError,
  decodeBuffer,
  detectEncoding,
  evaluateFileSizeStatus,
  loadDocumentFromPath,
  normalizeNewlines,
} from '../documentLoader';

const fixturesDir = path.resolve(__dirname, '../../..', 'tests/fixtures');

const fixture = (name: string) => path.join(fixturesDir, name);

const tempFile = (prefix: string, ext = '.tmp') =>
  path.join(fixturesDir, `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);

describe('evaluateFileSizeStatus', () => {
  it('flags warn and abort thresholds correctly', () => {
    expect(evaluateFileSizeStatus(5 * BYTES_PER_MB, 10, 200)).toBe('ok');
    expect(evaluateFileSizeStatus(15 * BYTES_PER_MB, 10, 200)).toBe('warn');
    expect(evaluateFileSizeStatus(250 * BYTES_PER_MB, 10, 200)).toBe('abort');
  });
});

describe('detectEncoding', () => {
  it('detects UTF-8 BOM', () => {
    const buffer = readFileSync(fixture('utf8_bom_sample.md'));
    const info = detectEncoding(buffer);
    expect(info.encoding).toBe('utf8-bom');
    expect(decodeBuffer(buffer, info)).toContain('BOM Heading');
  });

  it('detects Shift_JIS / CP932 content', () => {
    const buffer = readFileSync(fixture('cp932_sample.txt'));
    const info = detectEncoding(buffer);
    expect(info.encoding).toBe('shift_jis');
    expect(decodeBuffer(buffer, info)).toContain('日本語');
  });
});

describe('loadDocumentFromPath', () => {
  it('normalizes newlines and returns metadata', async () => {
    const settings = { ...defaultSettings };
    const doc = await loadDocumentFromPath(fixture('utf8_sample.md'), settings);
    expect(doc.fileName).toBe('utf8_sample.md');
    expect(doc.baseName).toBe('utf8_sample');
    expect(doc.encoding).toBe('utf8');
    expect(doc.isMarkdown).toBe(true);
    expect(doc.sizeStatus).toBe('ok');
    expect(doc.content).toContain('本文ライン1');
    expect(doc.content).not.toMatch(/\r/);
  });

  it('rejects files exceeding abort threshold', async () => {
    const tempPath = tempFile('large');
    const payload = 'x'.repeat(5 * 1024 * 1024);
    writeFileSync(tempPath, payload, 'utf8');

    const settings: AppSettings = {
      ...defaultSettings,
      input: { ...defaultSettings.input, maxWarnSizeMB: 1, maxAbortSizeMB: 2 },
    };
    try {
      await expect(loadDocumentFromPath(tempPath, settings)).rejects.toMatchObject({
        code: 'FILE_TOO_LARGE',
      });
    } finally {
      unlinkSync(tempPath);
    }
  });

  it('throws when encoding cannot be determined and fallback is reject', async () => {
    const tempPath = tempFile('binary', '.bin');
    writeFileSync(tempPath, Buffer.from([0xff, 0xff, 0xff]));
    const settings: AppSettings = {
      ...defaultSettings,
      input: { ...defaultSettings.input, encodingFallback: 'reject' },
    };
    try {
      await expect(loadDocumentFromPath(tempPath, settings)).rejects.toBeInstanceOf(DocumentLoadError);
    } finally {
      unlinkSync(tempPath);
    }
  });
});
