/**
 * Local job history for status auto-suggestions
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';

export type JobType = 'crawl' | 'batch' | 'extract';

interface JobHistoryEntry {
  id: string;
  updatedAt: string;
}

interface JobHistoryData {
  crawl: JobHistoryEntry[];
  batch: JobHistoryEntry[];
  extract: JobHistoryEntry[];
}

const HISTORY_DIR = join(process.cwd(), '.cache');
const HISTORY_PATH = join(HISTORY_DIR, 'job-history.json');
const MAX_ENTRIES = 20;

async function ensureHistoryDir(): Promise<void> {
  try {
    await fs.access(HISTORY_DIR);
  } catch {
    await fs.mkdir(HISTORY_DIR, { recursive: true });
  }
}

async function loadHistory(): Promise<JobHistoryData> {
  try {
    await fs.access(HISTORY_PATH);
  } catch {
    return { crawl: [], batch: [], extract: [] };
  }

  try {
    const data = await fs.readFile(HISTORY_PATH, 'utf-8');
    const parsed = JSON.parse(data) as Partial<JobHistoryData>;
    return {
      crawl: parsed.crawl ?? [],
      batch: parsed.batch ?? [],
      extract: parsed.extract ?? [],
    };
  } catch {
    return { crawl: [], batch: [], extract: [] };
  }
}

async function saveHistory(history: JobHistoryData): Promise<void> {
  await ensureHistoryDir();
  await fs.writeFile(HISTORY_PATH, JSON.stringify(history, null, 2));
}

export async function recordJob(type: JobType, id: string): Promise<void> {
  if (!id) return;

  const history = await loadHistory();
  const list = history[type];
  const now = new Date().toISOString();

  const filtered = list.filter((entry) => entry.id !== id);
  filtered.unshift({ id, updatedAt: now });
  history[type] = filtered.slice(0, MAX_ENTRIES);

  await saveHistory(history);
}

export async function getRecentJobIds(
  type: JobType,
  limit = 5
): Promise<string[]> {
  const history = await loadHistory();
  return history[type].slice(0, limit).map((entry) => entry.id);
}

export async function removeJobIds(
  type: JobType,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  const history = await loadHistory();
  history[type] = history[type].filter((entry) => !ids.includes(entry.id));
  await saveHistory(history);
}

export async function clearJobHistory(): Promise<void> {
  await saveHistory({ crawl: [], batch: [], extract: [] });
}
