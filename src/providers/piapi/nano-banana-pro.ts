import { CLIError } from '../../errors/base';
import { ExitCode } from '../../errors/codes';
import type { NanoBananaInput, NanoBananaOutput, SubmitTaskBody } from './types';

const ALLOWED_ASPECT_RATIOS = new Set([
  '1:1', '4:3', '3:2', '16:9', '9:16', '2:3', '3:4', '4:5', '5:4', '21:9',
]);
const ALLOWED_RESOLUTIONS = new Set(['1K', '2K', '4K']);
const ALLOWED_FORMATS = new Set(['png', 'jpeg']);
const ALLOWED_SAFETY = new Set(['low', 'medium', 'high']);
const MAX_IMAGE_URLS = 14;

export interface NanoBananaFlags {
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  outputFormat?: string;
  imageUrls?: string[];
  safetyLevel?: string;
}

export function buildNanoBananaTask(flags: NanoBananaFlags): SubmitTaskBody {
  const input: NanoBananaInput = { prompt: flags.prompt };

  if (flags.aspectRatio) {
    if (!ALLOWED_ASPECT_RATIOS.has(flags.aspectRatio)) {
      throw new CLIError(
        `Invalid --aspect-ratio: ${flags.aspectRatio}. Allowed: ${[...ALLOWED_ASPECT_RATIOS].join(', ')}`,
        ExitCode.USAGE,
      );
    }
    input.aspect_ratio = flags.aspectRatio;
  }

  if (flags.resolution) {
    if (!ALLOWED_RESOLUTIONS.has(flags.resolution)) {
      throw new CLIError(
        `Invalid --resolution: ${flags.resolution}. Allowed: ${[...ALLOWED_RESOLUTIONS].join(', ')}`,
        ExitCode.USAGE,
      );
    }
    input.resolution = flags.resolution as NanoBananaInput['resolution'];
  }

  if (flags.outputFormat) {
    if (!ALLOWED_FORMATS.has(flags.outputFormat)) {
      throw new CLIError(
        `Invalid --output-format: ${flags.outputFormat}. Allowed: ${[...ALLOWED_FORMATS].join(', ')}`,
        ExitCode.USAGE,
      );
    }
    input.output_format = flags.outputFormat as NanoBananaInput['output_format'];
  }

  if (flags.safetyLevel) {
    if (!ALLOWED_SAFETY.has(flags.safetyLevel)) {
      throw new CLIError(
        `Invalid --safety-level: ${flags.safetyLevel}. Allowed: ${[...ALLOWED_SAFETY].join(', ')}`,
        ExitCode.USAGE,
      );
    }
    input.safety_level = flags.safetyLevel as NanoBananaInput['safety_level'];
  }

  if (flags.imageUrls && flags.imageUrls.length > 0) {
    if (flags.imageUrls.length > MAX_IMAGE_URLS) {
      throw new CLIError(
        `Too many --image entries (${flags.imageUrls.length}). Max ${MAX_IMAGE_URLS}.`,
        ExitCode.USAGE,
      );
    }
    input.image_urls = flags.imageUrls;
  }

  return {
    model: 'gemini',
    task_type: 'nano-banana-pro',
    input: input as unknown as Record<string, unknown>,
  };
}

export function extractImageUrls(output: NanoBananaOutput | undefined): string[] {
  if (!output) return [];
  if (output.image_urls && output.image_urls.length > 0) return output.image_urls;
  if (output.image_url) return [output.image_url];
  return [];
}

export function defaultExtension(flags: NanoBananaFlags): string {
  return flags.outputFormat === 'jpeg' ? 'jpg' : 'png';
}
