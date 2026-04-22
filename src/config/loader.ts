import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import {
  parseConfigFile, REGIONS, PIAPI_BASE_URL,
  getMinimaxKey, getMinimaxRegion, getPiapiKey,
  type Config, type ConfigFile, type Region,
} from './schema';
import { ensureConfigDir, getConfigPath } from './paths';
import { detectOutputFormat, type OutputFormat } from '../output/formatter';
import type { GlobalFlags } from '../types/flags';

export function readConfigFile(): ConfigFile {
  const path = getConfigPath();
  if (!existsSync(path)) return {};
  try {
    return parseConfigFile(JSON.parse(readFileSync(path, 'utf-8')));
  } catch (err) {
    const e = err as Error;
    if (e instanceof SyntaxError || e.message.includes('JSON')) {
      process.stderr.write(`Warning: config file is corrupted. Run 'pimx config set' to reset.\n`);
    }
    return {};
  }
}

export async function writeConfigFile(data: Record<string, unknown>): Promise<void> {
  await ensureConfigDir();
  const path = getConfigPath();
  const tmp = path + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  renameSync(tmp, path);
}

export function loadConfig(flags: GlobalFlags): Config {
  const file = readConfigFile();

  const apiKey = flags.apiKey || undefined;
  const fileMinimaxKey = getMinimaxKey(file);
  const fileMinimaxRegion = getMinimaxRegion(file);
  const fileMinimaxBaseUrl = file.providers?.minimax?.base_url ?? file.base_url;
  const filePiapiKey = getPiapiKey(file);
  const filePiapiBaseUrl = file.providers?.piapi?.base_url;

  const explicitRegion = (flags.region as string) || process.env.MINIMAX_REGION || undefined;
  const cachedRegion = fileMinimaxRegion;
  const region = (explicitRegion || cachedRegion || 'global') as Region;

  const activeKey = apiKey || fileMinimaxKey;
  const needsRegionDetection = !explicitRegion
    && (!cachedRegion || (activeKey !== undefined && activeKey !== fileMinimaxKey));

  const minimaxBaseUrl = flags.baseUrl
    || process.env.MINIMAX_BASE_URL
    || fileMinimaxBaseUrl
    || REGIONS[region]
    || REGIONS.global;

  const output: OutputFormat = detectOutputFormat(
    flags.output || process.env.MINIMAX_OUTPUT || file.output,
  );

  const envTimeout = process.env.MINIMAX_TIMEOUT ? Number(process.env.MINIMAX_TIMEOUT) : undefined;
  const validEnvTimeout = envTimeout !== undefined && Number.isFinite(envTimeout) && envTimeout > 0
    ? envTimeout : undefined;
  const timeout = flags.timeout ?? validEnvTimeout ?? file.timeout ?? 300;

  const piapiKey = process.env.PIAPI_API_KEY || filePiapiKey;
  const piapiBaseUrl = process.env.PIAPI_BASE_URL || filePiapiBaseUrl || PIAPI_BASE_URL;

  return {
    apiKey,
    fileApiKey: fileMinimaxKey,
    fileRegion: fileMinimaxRegion,
    configPath: getConfigPath(),
    region,
    baseUrl: minimaxBaseUrl,
    output,
    timeout,
    defaultTextModel: file.default_text_model,
    defaultSpeechModel: file.default_speech_model,
    defaultVideoModel: file.default_video_model,
    defaultMusicModel: file.default_music_model,
    verbose: flags.verbose || process.env.MINIMAX_VERBOSE === '1',
    quiet: flags.quiet || false,
    noColor: flags.noColor || process.env.NO_COLOR !== undefined || !process.stdout.isTTY,
    yes: flags.yes || false,
    dryRun: flags.dryRun || false,
    nonInteractive: flags.nonInteractive || false,
    async: flags.async || false,
    needsRegionDetection,
    providers: {
      minimax: { apiKey: apiKey || fileMinimaxKey, region, baseUrl: minimaxBaseUrl },
      piapi:   { apiKey: piapiKey, baseUrl: piapiBaseUrl },
    },
  };
}
