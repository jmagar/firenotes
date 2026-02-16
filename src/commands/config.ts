/**
 * Config command implementation
 * Handles configuration and authentication
 */

import { Command } from 'commander';
import packageJson from '../../package.json';
import { type UserSettings, UserSettingsSchema } from '../schemas/storage';
import { getAuthSource, isAuthenticated } from '../utils/auth';
import { getConfigDirectoryPath } from '../utils/credentials';
import { getDefaultSettings } from '../utils/default-settings';
import { DEFAULT_QDRANT_COLLECTION } from '../utils/defaults';
import {
  clearSetting,
  getSettings,
  loadSettings,
  saveSettings,
} from '../utils/settings';
import { formatAsOfEst } from '../utils/style-output';
import { colorize, colors, fmt, icons } from '../utils/theme';

export interface ConfigureOptions {
  apiKey?: string;
  apiUrl?: string;
  json?: boolean;
}

// EnvItem stores display-ready values. Sensitive values are masked at build time
// to prevent clear-text logging of credentials (CodeQL: clear-text-logging).
type EnvItem = {
  key: string;
  value: string;
  masked?: boolean;
  warning?: string;
};

type RuntimeEnvJsonItem = {
  value: string;
  masked: boolean;
  warning?: string;
};

type ConfigDiagnostics = {
  authenticated: boolean;
  authSource: 'explicit' | 'env' | 'stored' | 'none';
  authSourceLabel: string;
  apiKeyStatus: 'Configured' | 'Not set';
  apiUrlStatus: 'Configured' | 'Not set';
  configPath: string;
  settings: {
    excludePaths: string[];
    excludeExtensions: string[];
  };
  commandDefaults: Record<string, Record<string, string>>;
  runtimeEnvironment: Record<
    string,
    { configured: boolean; masked: boolean; warning?: string }
  >;
};

const COMMAND_DEFAULT_COLORS = {
  command: colors.primary,
  option: colors.materialLightBlue,
} as const;

function configHeading(text: string): string {
  return fmt.bold(colorize(colors.primary, text));
}

function configLabel(text: string): string {
  return colorize(colors.primary, `${text}:`);
}

type SettingPath =
  | 'crawl.maxDepth'
  | 'crawl.sitemap'
  | 'search.limit'
  | 'scrape.timeoutSeconds'
  | 'http.timeoutMs'
  | 'chunking.maxChunkSize'
  | 'embedding.maxConcurrent'
  | 'polling.intervalMs';

type IntegerSettingPath = Exclude<SettingPath, 'crawl.sitemap'>;
type SettingValueByPath = {
  'crawl.maxDepth': number;
  'crawl.sitemap': 'skip' | 'include';
  'search.limit': number;
  'scrape.timeoutSeconds': number;
  'http.timeoutMs': number;
  'chunking.maxChunkSize': number;
  'embedding.maxConcurrent': number;
  'polling.intervalMs': number;
};

type SettingDefinition<K extends SettingPath> = {
  parse: (value: string) => SettingValueByPath[K];
  get: (settings: ReturnType<typeof getSettings>) => SettingValueByPath[K];
  set: (settings: UserSettings, value: SettingValueByPath[K]) => UserSettings;
};

type IntegerSettingBounds = {
  min: number;
  max: number;
};

const INTEGER_SETTING_BOUNDS: Record<IntegerSettingPath, IntegerSettingBounds> =
  {
    'crawl.maxDepth': { min: 1, max: 100 },
    'search.limit': { min: 1, max: 100 },
    'scrape.timeoutSeconds': { min: 1, max: 300 },
    'http.timeoutMs': { min: 1000, max: 300000 },
    'chunking.maxChunkSize': { min: 100, max: 10000 },
    'embedding.maxConcurrent': { min: 1, max: 50 },
    'polling.intervalMs': { min: 1000, max: 60000 },
  };

function parseIntegerSetting(key: IntegerSettingPath, value: string): number {
  const trimmed = value.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`Invalid numeric value for ${key}: ${value}`);
  }

  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Numeric value for ${key} is out of safe integer range`);
  }

  const bounds = INTEGER_SETTING_BOUNDS[key];
  if (parsed < bounds.min || parsed > bounds.max) {
    throw new Error(
      `Invalid value for ${key}: ${parsed} (expected ${bounds.min}-${bounds.max})`
    );
  }

  return parsed;
}

const SETTING_DEFINITIONS: {
  [K in SettingPath]: SettingDefinition<K>;
} = {
  'crawl.maxDepth': {
    parse: (value) => parseIntegerSetting('crawl.maxDepth', value),
    get: (settings) => settings.crawl.maxDepth,
    set: (settings, value) => ({
      ...settings,
      crawl: { ...settings.crawl, maxDepth: value },
    }),
  },
  'crawl.sitemap': {
    parse: (value) => {
      if (value !== 'skip' && value !== 'include') {
        throw new Error(`Invalid value for crawl.sitemap: ${value}`);
      }
      return value;
    },
    get: (settings) => settings.crawl.sitemap,
    set: (settings, value) => ({
      ...settings,
      crawl: { ...settings.crawl, sitemap: value },
    }),
  },
  'search.limit': {
    parse: (value) => parseIntegerSetting('search.limit', value),
    get: (settings) => settings.search.limit,
    set: (settings, value) => ({
      ...settings,
      search: { ...settings.search, limit: value },
    }),
  },
  'scrape.timeoutSeconds': {
    parse: (value) => parseIntegerSetting('scrape.timeoutSeconds', value),
    get: (settings) => settings.scrape.timeoutSeconds,
    set: (settings, value) => ({
      ...settings,
      scrape: { ...settings.scrape, timeoutSeconds: value },
    }),
  },
  'http.timeoutMs': {
    parse: (value) => parseIntegerSetting('http.timeoutMs', value),
    get: (settings) => settings.http.timeoutMs,
    set: (settings, value) => ({
      ...settings,
      http: { ...settings.http, timeoutMs: value },
    }),
  },
  'chunking.maxChunkSize': {
    parse: (value) => parseIntegerSetting('chunking.maxChunkSize', value),
    get: (settings) => settings.chunking.maxChunkSize,
    set: (settings, value) => ({
      ...settings,
      chunking: { ...settings.chunking, maxChunkSize: value },
    }),
  },
  'embedding.maxConcurrent': {
    parse: (value) => parseIntegerSetting('embedding.maxConcurrent', value),
    get: (settings) => settings.embedding.maxConcurrent,
    set: (settings, value) => ({
      ...settings,
      embedding: { ...settings.embedding, maxConcurrent: value },
    }),
  },
  'polling.intervalMs': {
    parse: (value) => parseIntegerSetting('polling.intervalMs', value),
    get: (settings) => settings.polling.intervalMs,
    set: (settings, value) => ({
      ...settings,
      polling: { ...settings.polling, intervalMs: value },
    }),
  },
};

const SETTING_PATHS = Object.keys(SETTING_DEFINITIONS) as SettingPath[];

// These keys are legacy aliases that users may still have in scripts.
// Keep them explicit for compatibility with pre-nested config commands.
const LEGACY_SETTING_KEYS = ['exclude-paths', 'exclude-extensions'] as const;

function maskValue(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === 'Not set') return 'Not set';
  if (trimmed.length >= 16) {
    return `${trimmed.substring(0, 6)}...${trimmed.slice(-4)}`;
  }
  return '*'.repeat(Math.min(trimmed.length, 8));
}

/**
 * Mask credentials in connection-string URLs.
 * Handles formats like: protocol://user:password@host:port/path
 * Returns the original string if it's not a valid URL.
 */
export function maskUrlCredentials(urlString: string): string {
  const trimmed = urlString.trim();
  if (trimmed.length === 0 || trimmed === 'Not set') return trimmed;

  try {
    const url = new URL(trimmed);
    // If URL has username or password, mask them
    if (url.username || url.password) {
      const maskedUsername = url.username ? maskValue(url.username) : '';
      const maskedPassword = url.password ? maskValue(url.password) : '';
      const credentials =
        maskedUsername && maskedPassword
          ? `${maskedUsername}:${maskedPassword}`
          : maskedUsername || maskedPassword;

      // Reconstruct URL with masked credentials
      return `${url.protocol}//${credentials}@${url.host}${url.pathname}${url.search}${url.hash}`;
    }
    // No credentials in URL, return as-is
    return trimmed;
  } catch {
    // Not a valid URL, return as-is (could be a plain string like "Not set")
    return trimmed;
  }
}

function presentValue(value: string | undefined): string {
  if (!value || value.trim().length === 0) return 'Not set';
  return value.trim();
}

function buildRuntimeEnvItems(): EnvItem[] {
  const openAiModel = process.env.OPENAI_MODEL;
  const qdrantCollection = presentValue(process.env.QDRANT_COLLECTION);

  return [
    { key: 'ASK_CLI', value: presentValue(process.env.ASK_CLI) },
    {
      key: 'SEARXNG_ENDPOINT',
      value: maskUrlCredentials(presentValue(process.env.SEARXNG_ENDPOINT)),
    },
    {
      key: 'SEARXNG_ENGINES',
      value: presentValue(process.env.SEARXNG_ENGINES),
    },
    {
      key: 'SEARXNG_CATEGORIES',
      value: presentValue(process.env.SEARXNG_CATEGORIES),
    },
    {
      key: 'OPENAI_API_KEY',
      value: maskValue(presentValue(process.env.OPENAI_API_KEY)),
      masked: true,
    },
    {
      key: 'OPENAI_BASE_URL',
      value: maskUrlCredentials(presentValue(process.env.OPENAI_BASE_URL)),
    },
    {
      key: 'OPENAI_MODEL',
      value: presentValue(openAiModel),
    },
    {
      key: 'AXON_EMBEDDER_WEBHOOK_URL',
      value: maskUrlCredentials(
        presentValue(process.env.AXON_EMBEDDER_WEBHOOK_URL)
      ),
    },
    {
      key: 'AXON_EMBEDDER_WEBHOOK_SECRET',
      value: maskValue(presentValue(process.env.AXON_EMBEDDER_WEBHOOK_SECRET)),
      masked: true,
    },
    { key: 'AXON_HOME', value: presentValue(process.env.AXON_HOME) },
    {
      key: 'QDRANT_DATA_DIR',
      value: presentValue(process.env.QDRANT_DATA_DIR),
    },
    {
      key: 'REDIS_URL',
      value: maskUrlCredentials(presentValue(process.env.REDIS_URL)),
    },
    {
      key: 'REDIS_RATE_LIMIT_URL',
      value: maskUrlCredentials(presentValue(process.env.REDIS_RATE_LIMIT_URL)),
    },
    {
      key: 'PLAYWRIGHT_MICROSERVICE_URL',
      value: maskUrlCredentials(
        presentValue(process.env.PLAYWRIGHT_MICROSERVICE_URL)
      ),
    },
    {
      key: 'NUQ_RABBITMQ_URL',
      value: maskUrlCredentials(presentValue(process.env.NUQ_RABBITMQ_URL)),
    },
    { key: 'POSTGRES_USER', value: presentValue(process.env.POSTGRES_USER) },
    {
      key: 'POSTGRES_PASSWORD',
      value: maskValue(presentValue(process.env.POSTGRES_PASSWORD)),
      masked: true,
    },
    { key: 'POSTGRES_DB', value: presentValue(process.env.POSTGRES_DB) },
    { key: 'POSTGRES_HOST', value: presentValue(process.env.POSTGRES_HOST) },
    { key: 'POSTGRES_PORT', value: presentValue(process.env.POSTGRES_PORT) },
    {
      key: 'TEI_URL',
      value: maskUrlCredentials(presentValue(process.env.TEI_URL)),
    },
    {
      key: 'QDRANT_URL',
      value: maskUrlCredentials(presentValue(process.env.QDRANT_URL)),
    },
    {
      key: 'QDRANT_COLLECTION',
      value:
        qdrantCollection === 'Not set'
          ? DEFAULT_QDRANT_COLLECTION
          : qdrantCollection,
    },
  ];
}

function printCommandDefaults(): void {
  const commandDefaults = getCommandDefaults();
  console.log('');
  console.log(configHeading('Command Defaults'));
  const commandEntries = Object.entries(commandDefaults);
  for (const [, [command, defaults]] of commandEntries.entries()) {
    console.log(`  ${colorize(COMMAND_DEFAULT_COLORS.command, `${command}:`)}`);
    const defaultEntries = Object.entries(defaults);
    for (const [, [key, value]] of defaultEntries.entries()) {
      console.log(
        `    ${icons.bullet} ${colorize(COMMAND_DEFAULT_COLORS.option, `${key}:`)} ${fmt.dim(value)}`
      );
    }
  }
}

function getCommandDefaults(): Record<string, Record<string, string>> {
  const settings = getSettings();

  return {
    scrape: {
      formats: settings.scrape.formats.join(','),
      onlyMainContent: String(settings.scrape.onlyMainContent),
      timeoutSeconds: String(settings.scrape.timeoutSeconds),
      excludeTags: settings.scrape.excludeTags.join(','),
      autoEmbed: String(settings.scrape.autoEmbed),
    },
    crawl: {
      wait: 'false',
      progress: 'false',
      pollIntervalSeconds: String(settings.crawl.pollIntervalSeconds),
      maxDepth: String(settings.crawl.maxDepth),
      sitemap: settings.crawl.sitemap,
      ignoreQueryParameters: String(settings.crawl.ignoreQueryParameters),
      crawlEntireDomain: String(settings.crawl.crawlEntireDomain),
      allowSubdomains: String(settings.crawl.allowSubdomains),
      onlyMainContent: String(settings.crawl.onlyMainContent),
      excludeTags: settings.crawl.excludeTags.join(','),
      autoEmbed: String(settings.crawl.autoEmbed),
    },
    map: {
      wait: 'false',
      sitemap: settings.map.sitemap,
      includeSubdomains:
        settings.map.includeSubdomains === null
          ? 'auto (defer to API)'
          : String(settings.map.includeSubdomains),
      ignoreQueryParameters:
        settings.map.ignoreQueryParameters === null
          ? 'auto (defer to API)'
          : String(settings.map.ignoreQueryParameters),
      ignoreCache:
        settings.map.ignoreCache === null
          ? 'auto (defer to API)'
          : String(settings.map.ignoreCache),
      filtering: 'enabled',
      defaultExcludes: 'enabled',
    },
    search: {
      limit: String(settings.search.limit),
      sources: settings.search.sources.join(','),
      timeoutMs: String(settings.search.timeoutMs),
      ignoreInvalidUrls: String(settings.search.ignoreInvalidUrls),
      scrape: String(settings.search.scrape),
      scrapeFormats: settings.search.scrapeFormats.join(','),
      onlyMainContent: String(settings.search.onlyMainContent),
      autoEmbed: String(settings.search.autoEmbed),
    },
    extract: {
      allowExternalLinks: String(settings.extract.allowExternalLinks),
      enableWebSearch: String(settings.extract.enableWebSearch),
      includeSubdomains: String(settings.extract.includeSubdomains),
      showSources: String(settings.extract.showSources),
      ignoreInvalidUrls: String(settings.extract.ignoreInvalidUrls),
      autoEmbed: String(settings.extract.autoEmbed),
    },
  };
}

function printRuntimeEnvironment(): void {
  console.log('');
  console.log(configHeading('Runtime Environment'));
  const runtimeItems = buildRuntimeEnvItems();
  for (const [, item] of runtimeItems.entries()) {
    const value = item.value;
    const warning = item.warning ? ` ${fmt.warning(`(${item.warning})`)}` : '';
    console.log(
      `  ${icons.bullet} ${colorize(COMMAND_DEFAULT_COLORS.option, `${item.key}:`)} ${fmt.dim(value)}${warning}`
    );
  }
}

function getAuthSourceLabel(
  authSource: 'explicit' | 'env' | 'stored' | 'none'
): string {
  if (authSource === 'env') return 'via FIRECRAWL_API_KEY';
  if (authSource === 'stored') return 'via stored credentials';
  if (authSource === 'explicit') return 'via --api-key';
  return '';
}

function buildConfigDiagnostics(): ConfigDiagnostics {
  const authSource = getAuthSource();
  const authenticated = isAuthenticated();
  const settings = loadSettings();

  const runtimeEnvironment: Record<string, RuntimeEnvJsonItem> = {};
  for (const item of buildRuntimeEnvItems()) {
    runtimeEnvironment[item.key] = {
      value: item.value,
      masked: !!item.masked,
      warning: item.warning,
    };
  }

  return {
    authenticated,
    authSource,
    authSourceLabel: getAuthSourceLabel(authSource),
    apiKeyStatus:
      authenticated && authSource !== 'none' ? 'Configured' : 'Not set',
    apiUrlStatus:
      authenticated && authSource !== 'none' ? 'Configured' : 'Not set',
    configPath: getConfigDirectoryPath(),
    settings: {
      excludePaths: settings.defaultExcludePaths ?? [],
      excludeExtensions: settings.defaultExcludeExtensions ?? [],
    },
    commandDefaults: getCommandDefaults(),
    runtimeEnvironment: Object.fromEntries(
      Object.entries(runtimeEnvironment).map(([key, item]) => [
        key,
        {
          configured: item.value !== 'Not set',
          masked: item.masked,
          warning: item.warning,
        },
      ])
    ),
  };
}

/**
 * Validate setting key, returning false and setting exitCode if invalid.
 */
function validateSettingKey(key: string): boolean {
  if (
    !LEGACY_SETTING_KEYS.includes(key as (typeof LEGACY_SETTING_KEYS)[number])
  ) {
    console.error(fmt.error(`Unknown setting "${key}".`));
    console.error(
      fmt.dim(`Available legacy settings: ${LEGACY_SETTING_KEYS.join(', ')}`)
    );
    console.error(fmt.dim(`Nested setting paths: ${SETTING_PATHS.join(', ')}`));
    process.exitCode = 1;
    return false;
  }
  return true;
}

function isSettingPath(value: string): value is SettingPath {
  return Object.hasOwn(SETTING_DEFINITIONS, value);
}

function formatValue(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

function getSettingByPath<K extends SettingPath>(
  settings: ReturnType<typeof getSettings>,
  key: K
): SettingValueByPath[K] {
  return SETTING_DEFINITIONS[key].get(settings);
}

function setSettingByPath<K extends SettingPath>(
  settings: UserSettings,
  key: K,
  value: SettingValueByPath[K]
): UserSettings {
  return SETTING_DEFINITIONS[key].set(settings, value);
}

/**
 * Configure/login - triggers login flow when not authenticated
 */
export async function configure(options: ConfigureOptions = {}): Promise<void> {
  // If not authenticated, trigger the login flow
  if (!isAuthenticated() || options.apiKey) {
    // Import handleLoginCommand to avoid circular dependency
    const { handleLoginCommand } = await import('./login');
    await handleLoginCommand({
      apiKey: options.apiKey,
      apiUrl: options.apiUrl,
    });
    return;
  }

  // Already authenticated - show config and offer to re-authenticate
  viewConfig({ json: options.json });
  if (options.json) return;
  console.log(fmt.dim('To re-authenticate, run: axon logout && axon config\n'));
}

/**
 * View current configuration (read-only)
 */
export function viewConfig(options: { json?: boolean } = {}): void {
  const diagnostics = buildConfigDiagnostics();
  if (options.json) {
    console.log(JSON.stringify(diagnostics, null, 2));
    return;
  }

  console.log('');
  console.log(
    `  ${fmt.primary(`${icons.success} axon`)} ${fmt.dim('cli')} ${fmt.dim(`v${packageJson.version}`)}`
  );
  console.log('');
  console.log(`  ${configHeading('Configuration')}`);
  console.log(
    `  ${fmt.dim(`Authenticated: ${diagnostics.authenticated ? 'yes' : 'no'} | Source: ${diagnostics.authSource} | Config: ${diagnostics.configPath}`)}`
  );
  console.log(`  ${fmt.dim(`As of (EST): ${formatAsOfEst()}`)}`);
  console.log('');

  if (diagnostics.authenticated) {
    console.log(
      `  ${fmt.success(icons.active)} Authenticated${diagnostics.authSourceLabel ? ` ${fmt.dim(diagnostics.authSourceLabel)}` : ''}`
    );
    console.log('');
    console.log(`  ${configLabel('API URL')} ${diagnostics.apiUrlStatus}`);
    console.log(`  ${configLabel('API Key')} ${diagnostics.apiKeyStatus}`);
    console.log(`  ${configLabel('Config')} ${diagnostics.configPath}`);

    // Show settings
    console.log('');
    console.log(configHeading('Settings'));
    if (diagnostics.settings.excludePaths.length > 0) {
      console.log(
        `  ${icons.bullet} ${configLabel('Exclude Paths')} ${diagnostics.settings.excludePaths.join(', ')}`
      );
    } else {
      console.log(
        `  ${icons.bullet} ${configLabel('Exclude Paths')} No exclude paths found on current configuration`
      );
    }
    if (diagnostics.settings.excludeExtensions.length > 0) {
      console.log(
        `  ${icons.bullet} ${configLabel('Exclude Extensions')} ${diagnostics.settings.excludeExtensions.join(', ')}`
      );
    } else {
      console.log(
        `  ${icons.bullet} ${configLabel('Exclude Extensions')} No custom exclude extensions found on current configuration (using built-in defaults)`
      );
    }

    printCommandDefaults();
    printRuntimeEnvironment();

    console.log('');
    console.log(configHeading('Commands'));
    console.log(
      `  ${icons.bullet} ${colorize(colors.primary, 'axon logout')} ${fmt.dim('      Clear credentials')}`
    );
    console.log(
      `  ${icons.bullet} ${colorize(colors.primary, 'axon config')} ${fmt.dim('      Re-authenticate')}`
    );
  } else {
    console.log(`  ${fmt.error(icons.active)} Not authenticated`);
    console.log('');
    console.log(fmt.dim('Run any command to start authentication, or use:'));
    console.log(
      fmt.dim('  axon config    Authenticate with browser or API key')
    );
  }
  console.log('');
}

/**
 * Handle config set <key> <value>
 */
export function handleConfigSet(key: string, value: string): void {
  if (key.includes('.') && !isSettingPath(key)) {
    console.error(fmt.error(`Unknown setting path "${key}".`));
    console.error(fmt.dim(`Nested setting paths: ${SETTING_PATHS.join(', ')}`));
    return;
  }

  if (isSettingPath(key)) {
    try {
      const parsedValue = SETTING_DEFINITIONS[key].parse(value);
      const current = loadSettings();
      const next = setSettingByPath(current, key, parsedValue);
      const validation = UserSettingsSchema.safeParse(next);
      if (!validation.success) {
        console.error(
          fmt.error(
            `Invalid setting value for ${key}: ${validation.error.message}`
          )
        );
        return;
      }

      saveSettings(validation.data);
      console.log(`${icons.success} ${key} set to ${formatValue(parsedValue)}`);
      return;
    } catch (error) {
      console.error(
        fmt.error(
          error instanceof Error ? error.message : 'Invalid setting value'
        )
      );
      return;
    }
  }

  if (!validateSettingKey(key)) return;

  const values = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

  if (values.length === 0) {
    console.error(fmt.error(`No ${key} provided.`));
    process.exitCode = 1;
    return;
  }

  if (key === 'exclude-paths') {
    saveSettings({ defaultExcludePaths: values });
    console.log(
      `${icons.success} Default exclude paths set: ${values.join(', ')}`
    );
  } else if (key === 'exclude-extensions') {
    saveSettings({ defaultExcludeExtensions: values });
    console.log(
      `${icons.success} Default exclude extensions set: ${values.join(', ')}`
    );
  }
}

/**
 * Handle config get <key>
 */
export function handleConfigGet(key: string): void {
  if (key.includes('.') && !isSettingPath(key)) {
    console.error(fmt.error(`Unknown setting path "${key}".`));
    console.error(fmt.dim(`Nested setting paths: ${SETTING_PATHS.join(', ')}`));
    return;
  }

  if (isSettingPath(key)) {
    const settings = getSettings();
    const value = getSettingByPath(settings, key);
    console.log(`${key}: ${formatValue(value)}`);
    return;
  }

  if (
    key !== 'exclude-paths' &&
    key !== 'exclude-extensions' &&
    key !== 'excludes'
  ) {
    console.error(fmt.error(`Unknown setting "${key}".`));
    console.error(
      fmt.dim('Available settings: exclude-paths, exclude-extensions, excludes')
    );
    console.error(fmt.dim(`Nested setting paths: ${SETTING_PATHS.join(', ')}`));
    process.exitCode = 1;
    return;
  }

  const settings = loadSettings();

  if (key === 'exclude-paths') {
    const paths = settings.defaultExcludePaths;
    if (!paths || paths.length === 0) {
      console.log(fmt.dim('No exclude paths found on current configuration.'));
    } else {
      console.log(`${icons.bullet} Default exclude paths: ${paths.join(', ')}`);
    }
  } else if (key === 'exclude-extensions') {
    const extensions = settings.defaultExcludeExtensions;
    if (!extensions || extensions.length === 0) {
      console.log(
        fmt.dim('No custom exclude extensions found on current configuration.')
      );
      console.log(fmt.dim('Using built-in defaults.'));
    } else {
      console.log(
        `${icons.bullet} Default exclude extensions: ${extensions.join(', ')}`
      );
    }
  } else if (key === 'excludes') {
    // Combined view of both paths and extensions
    const paths = settings.defaultExcludePaths;
    const extensions = settings.defaultExcludeExtensions;
    const activeExtensions =
      getSettings()?.defaultExcludeExtensions ??
      getDefaultSettings().defaultExcludeExtensions;

    console.log('');
    console.log(fmt.bold('Exclude Configuration'));
    console.log(
      fmt.dim(
        `Paths: ${paths?.length ?? 0} | Extensions: ${extensions?.length ?? activeExtensions.length}`
      )
    );
    console.log('');

    // Show paths
    console.log(fmt.primary('Paths:'));
    if (!paths || paths.length === 0) {
      console.log(fmt.dim('  No exclude paths found on current configuration'));
    } else {
      console.log(`  ${paths.join(', ')}`);
    }

    console.log('');

    // Show extensions with categories
    console.log(fmt.primary('Extensions:'));
    if (extensions && extensions.length > 0) {
      console.log(fmt.dim('  (custom configuration)'));
      console.log(`  ${extensions.join(', ')}`);
    } else {
      console.log(fmt.dim('  (using built-in defaults)'));

      // Group by category
      const executables = activeExtensions.filter((e) =>
        ['.exe', '.msi', '.dmg', '.pkg', '.deb', '.rpm'].includes(e)
      );
      const archives = activeExtensions.filter((e) =>
        ['.zip', '.tar', '.gz', '.bz2', '.7z', '.rar'].includes(e)
      );
      const media = activeExtensions.filter(
        (e) =>
          ![...executables, ...archives, '.ttf', '.woff', '.woff2'].includes(e)
      );
      const fonts = activeExtensions.filter((e) =>
        ['.ttf', '.woff', '.woff2'].includes(e)
      );

      if (executables.length > 0) {
        console.log(`  ${fmt.dim('Executables:')} ${executables.join(', ')}`);
      }
      if (archives.length > 0) {
        console.log(`  ${fmt.dim('Archives:')} ${archives.join(', ')}`);
      }
      if (media.length > 0) {
        console.log(`  ${fmt.dim('Media:')} ${media.join(', ')}`);
      }
      if (fonts.length > 0) {
        console.log(`  ${fmt.dim('Fonts:')} ${fonts.join(', ')}`);
      }
    }

    console.log('');
  }
}

/**
 * Handle config clear <key>
 */
export function handleConfigClear(key: string): void {
  if (!validateSettingKey(key)) return;

  if (key === 'exclude-paths') {
    clearSetting('defaultExcludePaths');
    console.log(`${icons.success} Default exclude paths cleared.`);
  } else if (key === 'exclude-extensions') {
    clearSetting('defaultExcludeExtensions');
    console.log(
      `${icons.success} Default exclude extensions cleared (will use built-in defaults).`
    );
  }
}

/**
 * Handle config reset [key]
 */
export function handleConfigReset(key?: string): void {
  const defaults = getDefaultSettings();

  if (!key) {
    saveSettings(defaults);
    console.log(`${icons.success} All settings reset to defaults.`);
    return;
  }

  if (!isSettingPath(key)) {
    console.error(fmt.error(`Unknown setting path "${key}".`));
    return;
  }

  const current = loadSettings();
  const next = setSettingByPath(current, key, getSettingByPath(defaults, key));
  const validation = UserSettingsSchema.safeParse(next);
  if (!validation.success) {
    console.error(
      fmt.error(`Invalid reset for ${key}: ${validation.error.message}`)
    );
    return;
  }

  saveSettings(validation.data);
  console.log(`${icons.success} ${key} reset to default.`);
}

/**
 * Create and configure the config command
 */
export function createConfigCommand(): Command {
  const configCmd = new Command('config')
    .description('Configure Axon (login if not authenticated)')
    .option(
      '-k, --api-key <key>',
      'Provide API key directly (skips interactive flow)'
    )
    .option(
      '--api-url <url>',
      'API URL (default: https://api.firecrawl.dev)',
      'https://api.firecrawl.dev'
    )
    .option('--json', 'Output configuration as JSON', false)
    .action(async (options) => {
      await configure({
        apiKey: options.apiKey,
        apiUrl: options.apiUrl,
        json: options.json,
      });
    });

  configCmd
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Setting key (e.g., exclude-paths)')
    .argument('<value>', 'Setting value (comma-separated for lists)')
    .action((key: string, value: string) => {
      handleConfigSet(key, value);
    });

  configCmd
    .command('get')
    .description('Get a configuration value')
    .argument('<key>', 'Setting key (e.g., exclude-paths)')
    .action((key: string) => {
      handleConfigGet(key);
    });

  configCmd
    .command('clear')
    .description('Clear a configuration value')
    .argument('<key>', 'Setting key (e.g., exclude-paths)')
    .action((key: string) => {
      handleConfigClear(key);
    });

  configCmd
    .command('reset [key]')
    .description('Reset setting to default value')
    .action((key?: string) => {
      handleConfigReset(key);
    });

  return configCmd;
}

/**
 * Create and configure the view-config command
 */
export function createViewConfigCommand(): Command {
  const viewConfigCmd = new Command('view-config')
    .description('View current configuration and authentication status')
    .option('--json', 'Output configuration as JSON', false)
    .action(async (options) => {
      await viewConfig({ json: options.json });
    });

  return viewConfigCmd;
}
