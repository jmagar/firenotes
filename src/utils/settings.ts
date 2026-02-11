/**
 * User settings utility
 * Stores persistent user settings in the unified Firecrawl home directory
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { type UserSettings, UserSettingsSchema } from '../schemas/storage';
import { getConfigDirectoryPath } from './credentials';
import { getSettingsPath as getUnifiedSettingsPath } from './storage-paths';
import { fmt } from './theme';

export type { UserSettings };

/**
 * Module-level flag to avoid repeated fs.existsSync checks for migration
 */
let migrationDone = false;

/**
 * Get the settings file path
 */
function getSettingsPath(): string {
  return getUnifiedSettingsPath();
}

function getLegacySettingsPaths(): string[] {
  const homeDir = os.homedir();
  return [
    path.join(
      homeDir,
      'Library',
      'Application Support',
      'firecrawl-cli',
      'settings.json'
    ),
    path.join(homeDir, 'AppData', 'Roaming', 'firecrawl-cli', 'settings.json'),
    path.join(homeDir, '.config', 'firecrawl-cli', 'settings.json'),
  ];
}

/**
 * Ensure the config directory exists
 */
function ensureConfigDir(): void {
  const configDir = getConfigDirectoryPath();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }
}

/**
 * Set file permissions to be readable/writable only by the owner
 */
function setSecurePermissions(filePath: string): void {
  try {
    fs.chmodSync(filePath, 0o600);
  } catch (_error) {
    // Ignore errors on Windows or if file doesn't exist
  }
}

/**
 * Migrate settings from legacy paths to FIRECRAWL_HOME path.
 */
function migrateLegacySettings(): void {
  if (migrationDone) {
    return;
  }

  const newPath = getSettingsPath();
  if (fs.existsSync(newPath)) {
    migrationDone = true;
    return;
  }

  for (const legacyPath of getLegacySettingsPaths()) {
    if (!fs.existsSync(legacyPath)) {
      continue;
    }

    try {
      const data = fs.readFileSync(legacyPath, 'utf-8');
      const parsed = JSON.parse(data);
      const validation = UserSettingsSchema.safeParse(parsed);
      if (!validation.success) {
        continue;
      }

      ensureConfigDir();
      try {
        fs.writeFileSync(newPath, JSON.stringify(validation.data, null, 2), {
          encoding: 'utf-8',
          flag: 'wx',
        });
        setSecurePermissions(newPath);
        console.error(
          fmt.dim(
            `[Settings] Migrated settings from ${legacyPath} to ${newPath}`
          )
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          // Another process created the file, treat as success
          console.error(
            fmt.dim(`[Settings] Settings already migrated by another process`)
          );
        } else {
          throw error;
        }
      }
      migrationDone = true;
      return;
    } catch {
      // Ignore invalid legacy files and continue checking others
    }
  }

  migrationDone = true;
}

/**
 * Load settings from disk
 */
export function loadSettings(): UserSettings {
  try {
    migrateLegacySettings();
    const settingsPath = getSettingsPath();
    if (!fs.existsSync(settingsPath)) {
      return {};
    }

    const data = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(data);

    // Validate with Zod schema for runtime type safety
    const result = UserSettingsSchema.safeParse(parsed);
    if (!result.success) {
      console.error(
        fmt.error(`[Settings] Invalid settings file: ${result.error.message}`)
      );
      return {};
    }

    return result.data;
  } catch {
    return {};
  }
}

/**
 * Save settings to disk (merges with existing)
 */
export function saveSettings(settings: Partial<UserSettings>): void {
  try {
    ensureConfigDir();
    const existing = loadSettings();
    const merged: UserSettings = { ...existing, ...settings };
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf-8');
    setSecurePermissions(settingsPath);
  } catch (error) {
    throw new Error(
      `Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Clear a specific setting key
 */
export function clearSetting(key: keyof UserSettings): void {
  try {
    const existing = loadSettings();
    delete existing[key];
    const settingsPath = getSettingsPath();

    if (Object.keys(existing).length === 0) {
      // Remove file if no settings remain
      if (fs.existsSync(settingsPath)) {
        fs.unlinkSync(settingsPath);
      }
      return;
    }

    ensureConfigDir();
    fs.writeFileSync(settingsPath, JSON.stringify(existing, null, 2), 'utf-8');
    setSecurePermissions(settingsPath);
  } catch (error) {
    throw new Error(
      `Failed to clear setting: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
