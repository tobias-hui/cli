export const REGIONS = {
  global: 'https://api.minimax.io',
  cn: 'https://api.minimaxi.com',
} as const;

export const DOCS_HOSTS = {
  global: 'https://platform.minimax.io',
  cn: 'https://platform.minimaxi.com',
} as const;

export const PIAPI_BASE_URL = 'https://api.piapi.ai';

export type Region = keyof typeof REGIONS;

export type ProviderId = 'minimax' | 'piapi';
export const PROVIDERS: readonly ProviderId[] = ['minimax', 'piapi'] as const;

export interface MinimaxProviderFile {
  api_key?: string;
  region?: Region;
  base_url?: string;
}

export interface PiapiProviderFile {
  api_key?: string;
  base_url?: string;
}

export interface ProvidersFile {
  minimax?: MinimaxProviderFile;
  piapi?: PiapiProviderFile;
}

export interface ConfigFile {
  providers?: ProvidersFile;
  // Flat fields are treated as the MiniMax provider (back-compat).
  api_key?: string;
  region?: Region;
  base_url?: string;
  output?: 'text' | 'json';
  timeout?: number;
  default_text_model?: string;
  default_speech_model?: string;
  default_video_model?: string;
  default_music_model?: string;
}

const VALID_REGIONS = new Set<string>(['global', 'cn']);
const VALID_OUTPUTS = new Set<string>(['text', 'json']);

function parseMinimaxProvider(raw: unknown): MinimaxProviderFile | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const out: MinimaxProviderFile = {};
  if (typeof obj.api_key === 'string') out.api_key = obj.api_key;
  if (typeof obj.region === 'string' && VALID_REGIONS.has(obj.region)) out.region = obj.region as Region;
  if (typeof obj.base_url === 'string' && obj.base_url.startsWith('http')) out.base_url = obj.base_url;
  return Object.keys(out).length ? out : undefined;
}

function parsePiapiProvider(raw: unknown): PiapiProviderFile | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const out: PiapiProviderFile = {};
  if (typeof obj.api_key === 'string') out.api_key = obj.api_key;
  if (typeof obj.base_url === 'string' && obj.base_url.startsWith('http')) out.base_url = obj.base_url;
  return Object.keys(out).length ? out : undefined;
}

function parseProviders(raw: unknown): ProvidersFile | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const obj = raw as Record<string, unknown>;
  const out: ProvidersFile = {};
  const mm = parseMinimaxProvider(obj.minimax);
  if (mm) out.minimax = mm;
  const pi = parsePiapiProvider(obj.piapi);
  if (pi) out.piapi = pi;
  return Object.keys(out).length ? out : undefined;
}

export function parseConfigFile(raw: unknown): ConfigFile {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const out: ConfigFile = {};

  const providers = parseProviders(obj.providers);
  if (providers) out.providers = providers;

  if (typeof obj.api_key === 'string') out.api_key = obj.api_key;
  if (typeof obj.region === 'string' && VALID_REGIONS.has(obj.region)) out.region = obj.region as Region;
  if (typeof obj.base_url === 'string' && obj.base_url.startsWith('http')) out.base_url = obj.base_url;
  if (typeof obj.output === 'string' && VALID_OUTPUTS.has(obj.output)) out.output = obj.output as ConfigFile['output'];
  if (typeof obj.timeout === 'number' && obj.timeout > 0) out.timeout = obj.timeout;
  if (typeof obj.default_text_model === 'string' && obj.default_text_model.length > 0) out.default_text_model = obj.default_text_model;
  if (typeof obj.default_speech_model === 'string' && obj.default_speech_model.length > 0) out.default_speech_model = obj.default_speech_model;
  if (typeof obj.default_video_model === 'string' && obj.default_video_model.length > 0) out.default_video_model = obj.default_video_model;
  if (typeof obj.default_music_model === 'string' && obj.default_music_model.length > 0) out.default_music_model = obj.default_music_model;

  return out;
}

/**
 * Get the active MiniMax api_key from a parsed ConfigFile, checking the
 * nested providers.minimax section first, then the flat back-compat field.
 */
export function getMinimaxKey(file: ConfigFile): string | undefined {
  return file.providers?.minimax?.api_key ?? file.api_key;
}

export function getMinimaxRegion(file: ConfigFile): Region | undefined {
  return file.providers?.minimax?.region ?? file.region;
}

export function getPiapiKey(file: ConfigFile): string | undefined {
  return file.providers?.piapi?.api_key;
}

export interface ResolvedProviders {
  minimax: { apiKey?: string; region: Region; baseUrl: string };
  piapi:   { apiKey?: string; baseUrl: string };
}

export interface Config {
  apiKey?: string;
  fileApiKey?: string;
  fileRegion?: Region;
  configPath?: string;
  region: Region;
  baseUrl: string;
  output: 'text' | 'json';
  timeout: number;
  defaultTextModel?: string;
  defaultSpeechModel?: string;
  defaultVideoModel?: string;
  defaultMusicModel?: string;
  verbose: boolean;
  quiet: boolean;
  noColor: boolean;
  yes: boolean;
  dryRun: boolean;
  nonInteractive: boolean;
  async: boolean;
  needsRegionDetection?: boolean;
  providers?: ResolvedProviders;
}
