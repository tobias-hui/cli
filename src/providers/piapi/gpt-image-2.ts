import { CLIError } from '../../errors/base';
import { ExitCode } from '../../errors/codes';

const ALLOWED_SIZES = new Set(['1024x1024', '1024x1536', '1536x1024', 'auto']);
const ALLOWED_QUALITIES = new Set(['low', 'medium', 'high', 'auto']);
const ALLOWED_FORMATS = new Set(['png', 'jpeg', 'webp']);
const MAX_N = 10;

export interface GptImage2Flags {
  prompt: string;
  n?: number;
  size?: string;
  quality?: string;
  outputFormat?: string;
}

export interface GptImage2Request {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  quality?: string;
  output_format?: string;
}

export interface GptImage2Response {
  data: Array<{ url?: string; b64_json?: string }>;
  created?: number;
  usage?: Record<string, unknown>;
}

export function buildGptImage2Request(
  flags: GptImage2Flags,
  model = 'gpt-image-2-preview',
): GptImage2Request {
  if (flags.size && !ALLOWED_SIZES.has(flags.size)) {
    throw new CLIError(
      `Invalid --size: ${flags.size}. Allowed: ${[...ALLOWED_SIZES].join(', ')}`,
      ExitCode.USAGE,
    );
  }
  if (flags.quality && !ALLOWED_QUALITIES.has(flags.quality)) {
    throw new CLIError(
      `Invalid --quality: ${flags.quality}. Allowed: ${[...ALLOWED_QUALITIES].join(', ')}`,
      ExitCode.USAGE,
    );
  }
  if (flags.outputFormat && !ALLOWED_FORMATS.has(flags.outputFormat)) {
    throw new CLIError(
      `Invalid --output-format: ${flags.outputFormat}. Allowed: ${[...ALLOWED_FORMATS].join(', ')}`,
      ExitCode.USAGE,
    );
  }
  if (flags.n !== undefined) {
    if (!Number.isInteger(flags.n) || flags.n < 1 || flags.n > MAX_N) {
      throw new CLIError(
        `Invalid --n: ${flags.n}. Must be an integer between 1 and ${MAX_N}.`,
        ExitCode.USAGE,
      );
    }
  }

  const req: GptImage2Request = { model, prompt: flags.prompt };
  if (flags.n !== undefined) req.n = flags.n;
  if (flags.size) req.size = flags.size;
  if (flags.quality) req.quality = flags.quality;
  if (flags.outputFormat) req.output_format = flags.outputFormat;
  return req;
}

export function extractGptImage2Urls(res: GptImage2Response): string[] {
  return (res.data ?? [])
    .map(d => d.url)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
}

export function defaultExtensionGptImage2(flags: GptImage2Flags): string {
  switch (flags.outputFormat) {
    case 'jpeg': return 'jpg';
    case 'webp': return 'webp';
    default: return 'png';
  }
}
