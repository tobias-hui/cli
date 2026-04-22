import { defineCommand } from '../../command';
import { CLIError } from '../../errors/base';
import { ExitCode } from '../../errors/codes';
import { requestJson } from '../../client/http';
import { imageEndpoint } from '../../client/endpoints';
import { downloadFile } from '../../files/download';
import { formatOutput, detectOutputFormat } from '../../output/formatter';
import type { Config } from '../../config/schema';
import type { ProviderId } from '../../config/schema';
import type { GlobalFlags } from '../../types/flags';
import type { ImageRequest, ImageResponse } from '../../types/api';
import { mkdirSync, existsSync, readFileSync } from 'fs';
import { join, resolve, extname } from 'path';

import { resolveProvider } from '../../providers/registry';
import {
  buildNanoBananaTask, extractImageUrls, defaultExtension,
  type NanoBananaFlags,
} from '../../providers/piapi/nano-banana-pro';
import { runTask, submitTask, openaiFetch } from '../../providers/piapi/client';
import type { NanoBananaOutput } from '../../providers/piapi/types';
import {
  buildGptImage2Request, extractGptImage2Urls, defaultExtensionGptImage2,
  type GptImage2Flags, type GptImage2Response,
} from '../../providers/piapi/gpt-image-2';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp',
};
import { isInteractive } from '../../utils/env';
import { promptText, failIfMissing } from '../../utils/prompt';

const DEFAULT_MINIMAX_MODEL = 'image-01';
const DEFAULT_PIAPI_MODEL = 'nano-banana-pro';

export default defineCommand({
  name: 'image generate',
  description: 'Generate images (MiniMax image-01 / PiAPI nano-banana-pro)',
  apiDocs: '/docs/api-reference/image-generation-t2i',
  usage: 'pimx image generate --prompt <text> [--model <name>] [--provider <minimax|piapi>] [flags]',
  options: [
    { flag: '--prompt <text>', description: 'Image description', required: true },
    { flag: '--model <name>', description: 'Model name (default: image-01 for minimax, nano-banana-pro for piapi)' },
    { flag: '--provider <id>', description: 'Provider: minimax, piapi (inferred from model when omitted)' },
    { flag: '--aspect-ratio <ratio>', description: 'Aspect ratio (e.g. 16:9, 1:1). MiniMax: ignored if --width/--height set.' },
    { flag: '--n <count>', description: '[minimax] Number of images to generate (default: 1)', type: 'number' },
    { flag: '--seed <n>', description: '[minimax] Random seed', type: 'number' },
    { flag: '--width <px>', description: '[minimax] Custom width in pixels, 512–2048, multiple of 8', type: 'number' },
    { flag: '--height <px>', description: '[minimax] Custom height in pixels, 512–2048, multiple of 8', type: 'number' },
    { flag: '--prompt-optimizer', description: '[minimax] Optimize the prompt before generation.' },
    { flag: '--aigc-watermark', description: '[minimax] Embed AI-generated content watermark.' },
    { flag: '--subject-ref <params>', description: '[minimax] Subject reference: type=character,image=path-or-url' },
    { flag: '--resolution <level>', description: '[piapi nano-banana-pro] 1K (default), 2K, 4K' },
    { flag: '--output-format <fmt>', description: '[piapi] png (default), jpeg (gpt-image-2: +webp)' },
    { flag: '--image <url>', description: '[piapi nano-banana-pro] Input image URL for edit (repeatable, max 14)', type: 'array' },
    { flag: '--safety-level <level>', description: '[piapi nano-banana-pro] low, medium, high (default high)' },
    { flag: '--size <WxH>', description: '[piapi gpt-image-2] 1024x1024 (default), 1024x1536, 1536x1024, auto' },
    { flag: '--quality <level>', description: '[piapi gpt-image-2] low (default), medium, high, auto' },
    { flag: '--async', description: '[piapi nano-banana-pro] Submit and return task_id without waiting' },
    { flag: '--out-dir <dir>', description: 'Download images to directory' },
    { flag: '--out-prefix <prefix>', description: 'Filename prefix (default: image)' },
    { flag: '--out <path>', description: 'Single-file download path (piapi, overrides --out-dir)' },
  ],
  examples: [
    'pimx image generate --prompt "A cat in a spacesuit on Mars" --aspect-ratio 16:9',
    'pimx image generate --prompt "Logo design" --n 3 --out-dir ./generated/',
    '# PiAPI: Nano Banana Pro',
    'pimx image generate --model nano-banana-pro --prompt "hero banner" --aspect-ratio 16:9 --out hero.png',
    '# PiAPI: gpt-image-2-preview (OpenAI-compatible, synchronous)',
    'pimx image generate --model gpt-image-2-preview --prompt "a cute sea otter" --size 1024x1024 --quality low --out otter.png',
    '# Image-to-image edit',
    'pimx image generate --model nano-banana-pro --prompt "sunset background" --image https://... --out-dir ./out/',
  ],
  async run(config: Config, flags: GlobalFlags) {
    let prompt = (flags.prompt ?? (flags._positional as string[]|undefined)?.[0]) as string | undefined;

    if (!prompt) {
      if (isInteractive({ nonInteractive: config.nonInteractive })) {
        const hint = await promptText({
          message: 'Enter your image prompt:',
        });
        if (!hint) {
          process.stderr.write('Image generation cancelled.\n');
          process.exit(1);
        }
        prompt = hint;
      } else {
        failIfMissing('prompt', 'pimx image generate --prompt <text>');
      }
    }

    const explicitProvider = flags.provider as ProviderId | undefined;
    const requestedModel = flags.model as string | undefined;

    let provider: ProviderId;
    let model: string;

    if (requestedModel) {
      const resolved = resolveProvider(requestedModel, explicitProvider);
      provider = resolved.provider;
      model = requestedModel;
    } else if (explicitProvider) {
      provider = explicitProvider;
      model = provider === 'piapi' ? DEFAULT_PIAPI_MODEL : DEFAULT_MINIMAX_MODEL;
    } else {
      provider = 'minimax';
      model = DEFAULT_MINIMAX_MODEL;
    }

    if (provider === 'piapi') {
      await runPiapi(config, flags, prompt, model);
      return;
    }

    await runMinimax(config, flags, prompt, model);
  },
});

async function runPiapi(config: Config, flags: GlobalFlags, prompt: string, model: string): Promise<void> {
  if (model === 'gpt-image-2-preview') {
    await runPiapiGptImage2(config, flags, prompt, model);
    return;
  }
  if (model !== 'nano-banana-pro') {
    throw new CLIError(
      `Unsupported PiAPI image model: ${model}`,
      ExitCode.USAGE,
      'Supported: nano-banana-pro, gpt-image-2-preview',
    );
  }

  const adapterFlags: NanoBananaFlags = {
    prompt,
    aspectRatio: flags.aspectRatio as string | undefined,
    resolution: flags.resolution as string | undefined,
    outputFormat: flags.outputFormat as string | undefined,
    safetyLevel: flags.safetyLevel as string | undefined,
    imageUrls: flags.image as string[] | undefined,
  };
  const body = buildNanoBananaTask(adapterFlags);
  const format = detectOutputFormat(config.output);

  if (config.dryRun) {
    console.log(formatOutput({ provider: 'piapi', request: body }, format));
    return;
  }

  if (config.async) {
    const submitted = await submitTask<NanoBananaOutput>(config, body);
    console.log(formatOutput({
      provider: 'piapi',
      model,
      task_id: submitted.task_id,
      status: submitted.status,
    }, format));
    return;
  }

  const task = await runTask<NanoBananaOutput>(config, body);
  const imageUrls = extractImageUrls(task.output);
  if (imageUrls.length === 0) {
    throw new CLIError('PiAPI task completed but returned no image URLs.', ExitCode.GENERAL);
  }

  const singlePath = flags.out as string | undefined;
  const outDir = (flags.outDir as string | undefined) ?? '.';
  const prefix = (flags.outPrefix as string) || 'image';
  const ext = defaultExtension(adapterFlags);
  const saved: string[] = [];

  if (singlePath && imageUrls.length === 1) {
    await downloadFile(imageUrls[0]!, singlePath, { quiet: config.quiet });
    saved.push(singlePath);
  } else {
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    for (let i = 0; i < imageUrls.length; i++) {
      const filename = imageUrls.length === 1
        ? `${prefix}.${ext}`
        : `${prefix}_${String(i + 1).padStart(3, '0')}.${ext}`;
      const destPath = join(outDir, filename);
      if (existsSync(destPath)) {
        process.stderr.write(`Warning: overwriting existing file: ${destPath}\n`);
      }
      await downloadFile(imageUrls[i]!, destPath, { quiet: config.quiet });
      saved.push(destPath);
    }
  }

  if (!config.quiet) {
    process.stderr.write(`[Model: ${model} via piapi]\n`);
  }

  const result = {
    provider: 'piapi',
    model,
    task_id: task.task_id,
    saved,
    status: task.status,
  };

  if (format === 'json') {
    console.log(formatOutput(result, format));
  } else if (config.quiet) {
    console.log(saved.join('\n'));
  } else {
    console.log(formatOutput(result, format));
  }
}

async function runPiapiGptImage2(
  config: Config, flags: GlobalFlags, prompt: string, model: string,
): Promise<void> {
  const adapterFlags: GptImage2Flags = {
    prompt,
    n: flags.n as number | undefined,
    size: flags.size as string | undefined,
    quality: flags.quality as string | undefined,
    outputFormat: flags.outputFormat as string | undefined,
  };
  const body = buildGptImage2Request(adapterFlags, model);
  const format = detectOutputFormat(config.output);

  if (config.dryRun) {
    console.log(formatOutput({ provider: 'piapi', request: body }, format));
    return;
  }

  const response = await openaiFetch<GptImage2Response>(
    config, '/v1/images/generations', { method: 'POST', body },
  );
  const imageUrls = extractGptImage2Urls(response);
  if (imageUrls.length === 0) {
    throw new CLIError('gpt-image-2 returned no image URLs.', ExitCode.GENERAL);
  }

  const singlePath = flags.out as string | undefined;
  const outDir = (flags.outDir as string | undefined) ?? '.';
  const prefix = (flags.outPrefix as string) || 'image';
  const ext = defaultExtensionGptImage2(adapterFlags);
  const saved: string[] = [];

  if (singlePath && imageUrls.length === 1) {
    await downloadFile(imageUrls[0]!, singlePath, { quiet: config.quiet });
    saved.push(singlePath);
  } else {
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    for (let i = 0; i < imageUrls.length; i++) {
      const filename = imageUrls.length === 1
        ? `${prefix}.${ext}`
        : `${prefix}_${String(i + 1).padStart(3, '0')}.${ext}`;
      const destPath = join(outDir, filename);
      if (existsSync(destPath)) {
        process.stderr.write(`Warning: overwriting existing file: ${destPath}\n`);
      }
      await downloadFile(imageUrls[i]!, destPath, { quiet: config.quiet });
      saved.push(destPath);
    }
  }

  if (!config.quiet) {
    process.stderr.write(`[Model: ${model} via piapi]\n`);
  }

  const result = {
    provider: 'piapi',
    model,
    saved,
    created: response.created,
  };

  if (format === 'json') {
    console.log(formatOutput(result, format));
  } else if (config.quiet) {
    console.log(saved.join('\n'));
  } else {
    console.log(formatOutput(result, format));
  }
}

async function runMinimax(config: Config, flags: GlobalFlags, prompt: string, model: string): Promise<void> {
  // Validate width/height
  const width = flags.width as number | undefined;
  const height = flags.height as number | undefined;

  if (width !== undefined && height === undefined) {
    throw new CLIError('--width requires --height. Both must be specified together.', ExitCode.USAGE);
  }
  if (height !== undefined && width === undefined) {
    throw new CLIError('--height requires --width. Both must be specified together.', ExitCode.USAGE);
  }
  if (width !== undefined && height !== undefined) {
    const validateSize = (name: string, val: number) => {
      if (val < 512 || val > 2048) {
        throw new CLIError(`--${name} must be between 512 and 2048, got ${val}.`, ExitCode.USAGE);
      }
      if (val % 8 !== 0) {
        throw new CLIError(`--${name} must be a multiple of 8, got ${val}.`, ExitCode.USAGE);
      }
    };
    validateSize('width', width);
    validateSize('height', height);
  }

  const body: ImageRequest = {
    model,
    prompt,
    aspect_ratio: (width !== undefined && height !== undefined) ? undefined : ((flags.aspectRatio as string) || undefined),
    n: (flags.n as number) ?? 1,
    seed: flags.seed as number | undefined,
    width: width,
    height: height,
    prompt_optimizer: flags.promptOptimizer === true || undefined,
    aigc_watermark: flags.aigcWatermark === true || undefined,
  };

  if (flags.subjectRef) {
    const refStr = flags.subjectRef as string;
    const params = Object.fromEntries(
      refStr.split(',').map(p => {
      const eqIdx = p.indexOf('=');
      if (eqIdx === -1) return [p, ''];
      return [p.slice(0, eqIdx), p.slice(eqIdx + 1)];
    }),
    );

    const ref: { type: string; image_url?: string; image_file?: string } = {
      type: params.type || 'character',
    };

    if (params.image) {
      if (params.image.startsWith('http')) {
        ref.image_url = params.image;
      } else {
        const imgPath = resolve(params.image);
        const imgData = readFileSync(imgPath);
        const ext = extname(imgPath).toLowerCase();
        const mime = MIME_TYPES[ext] || 'image/jpeg';
        ref.image_file = `data:${mime};base64,${imgData.toString('base64')}`;
      }
    }

    body.subject_reference = [ref];
  }

  const format = detectOutputFormat(config.output);

  if (config.dryRun) {
    console.log(formatOutput({ request: body }, format));
    return;
  }

  const url = imageEndpoint(config.baseUrl);
  const response = await requestJson<ImageResponse>(config, {
    url,
    method: 'POST',
    body,
  });

  const imageUrls = response.data.image_urls || [];

  if (!config.quiet) {
    process.stderr.write(`[Model: ${model}]\n`);
  }

  const outDir = (flags.outDir as string | undefined) ?? '.';
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const prefix = (flags.outPrefix as string) || 'image';
  const saved: string[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const filename = `${prefix}_${String(i + 1).padStart(3, '0')}.jpg`;
    const destPath = join(outDir, filename);

    if (existsSync(destPath)) {
      process.stderr.write(`Warning: overwriting existing file: ${destPath}\n`);
    }

    await downloadFile(imageUrls[i]!, destPath, { quiet: config.quiet });
    saved.push(destPath);
  }

  if (format === 'json') {
    console.log(formatOutput({
      id: response.data.task_id,
      saved,
      success_count: response.data.success_count,
      failed_count: response.data.failed_count,
    }, format));
  } else if (config.quiet) {
    console.log(saved.join('\n'));
  } else {
    console.log(formatOutput({
      id: response.data.task_id,
      saved,
      success_count: response.data.success_count,
      failed_count: response.data.failed_count,
    }, format));
  }
}
