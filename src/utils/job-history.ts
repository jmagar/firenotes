/**
 * Local job history for status auto-suggestions
 */

import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
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

const MAX_ENTRIES = 20;

/**
 * Get the data directory following XDG Base Directory spec
 * Primary: $XDG_DATA_HOME/firecrawl-cli/ (usually ~/.local/share/firecrawl-cli/)
 * Fallback: ~/.config/firecrawl-cli/
 */
function getDataDir(): string {
  const xdgDataHome = process.env.XDG_DATA_HOME;
  if (xdgDataHome) {
    return join(xdgDataHome, 'firecrawl-cli');
  }
  // Fallback to ~/.local/share on Linux/Mac, ~/.config on others
  const home = homedir();
  return join(home, '.local', 'share', 'firecrawl-cli');
}

/**
 * Get legacy cache directory path for migration
 */
function getLegacyCachePath(): string {
  return join(process.cwd(), '.cache', 'job-history.json');
}

const HISTORY_DIR = getDataDir();
const HISTORY_PATH = join(HISTORY_DIR, 'job-history.json');

async function ensureHistoryDir(): Promise<void> {
  try {
    await fs.access(HISTORY_DIR);
  } catch {
    await fs.mkdir(HISTORY_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Migrate job history from legacy cache directory if it exists
 */
async function migrateLegacyHistory(): Promise<void> {
  const legacyPath = getLegacyCachePath();
  try {
    // Check if legacy file exists
    await fs.access(legacyPath);

    // Check if new file already exists
    try {
      await fs.access(HISTORY_PATH);
      // New file exists, no migration needed
      return;
    } catch {
      // New file doesn't exist, proceed with migration
    }

    // Read legacy data
    const legacyData = await fs.readFile(legacyPath, 'utf-8');
    const _parsed = JSON.parse(legacyData) as Partial<JobHistoryData>;

    // Ensure new directory exists
    await ensureHistoryDir();

    // Write to new location
    await fs.writeFile(HISTORY_PATH, legacyData);

    console.error(
      `[Job History] Migrated from ${legacyPath} to ${HISTORY_PATH}`
    );
  } catch {
    // No legacy file or migration failed silently - not critical
  }
}

async function loadHistory(): Promise<JobHistoryData> {
  // Attempt migration first (idempotent)
  await migrateLegacyHistory();

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
