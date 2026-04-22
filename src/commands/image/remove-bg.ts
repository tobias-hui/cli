import { defineCommand } from '../../command';
import { CLIError } from '../../errors/base';
import { ExitCode } from '../../errors/codes';
import { downloadFile } from '../../files/download';
import { formatOutput, detectOutputFormat } from '../../output/formatter';
import type { Config } from '../../config/schema';
import type { GlobalFlags } from '../../types/flags';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

import { buildRemoveBgTask, type RemoveBgFlags } from '../../providers/piapi/background-remove';
import { runTask, submitTask } from '../../providers/piapi/client';
import { extractImageUrls } from '../../providers/piapi/nano-banana-pro';
import type { NanoBananaOutput } from '../../providers/piapi/types';

const DEFAULT_OUTPUT = 'removed-bg.png';

export default defineCommand({
  name: 'image remove-bg',
  description: 'Remove image background via PiAPI (Qubico/image-toolkit)',
  usage: 'pimx image remove-bg --image <url> [--rmbg-model <name>] [--output <path>] [--async]',
  options: [
    { flag: '--image <url>', description: 'Public URL of the source image', required: true },
    { flag: '--rmbg-model <name>', description: 'Model: RMBG-1.4 (default), RMBG-2.0, BEN2' },
    { flag: '--out <path>', description: `Output file path (default: ${DEFAULT_OUTPUT})` },
    { flag: '--async', description: 'Submit and return task_id without waiting' },
  ],
  examples: [
    'pimx image remove-bg --image https://example.com/photo.jpg --out clean.png',
    'pimx image remove-bg --image https://example.com/photo.jpg --rmbg-model BEN2 --out ben.png',
    'pimx image remove-bg --image https://example.com/photo.jpg --async --output json',
  ],
  async run(config: Config, flags: GlobalFlags) {
    const image = flags.image as string | undefined;
    if (!image) {
      throw new CLIError(
        '--image is required.',
        ExitCode.USAGE,
        'pimx image remove-bg --image <url>',
      );
    }

    const adapterFlags: RemoveBgFlags = {
      image,
      rmbgModel: flags.rmbgModel as string | undefined,
    };
    const body = buildRemoveBgTask(adapterFlags);
    const format = detectOutputFormat(config.output);

    if (config.dryRun) {
      console.log(formatOutput({ provider: 'piapi', request: body }, format));
      return;
    }

    if (config.async) {
      const submitted = await submitTask<NanoBananaOutput>(config, body);
      console.log(formatOutput({
        provider: 'piapi',
        model: 'Qubico/image-toolkit',
        task_type: 'background-remove',
        task_id: submitted.task_id,
        status: submitted.status,
      }, format));
      return;
    }

    const task = await runTask<NanoBananaOutput>(config, body);
    const urls = extractImageUrls(task.output);
    if (urls.length === 0) {
      throw new CLIError('PiAPI task completed but returned no image URL.', ExitCode.GENERAL);
    }

    const destPath = (flags.out as string | undefined) ?? DEFAULT_OUTPUT;
    const dir = dirname(destPath);
    if (dir && dir !== '.' && !existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (existsSync(destPath)) {
      process.stderr.write(`Warning: overwriting existing file: ${destPath}\n`);
    }
    await downloadFile(urls[0]!, destPath, { quiet: config.quiet });

    if (!config.quiet) {
      process.stderr.write(`[Model: Qubico/image-toolkit · ${adapterFlags.rmbgModel ?? 'RMBG-1.4'}]\n`);
    }

    const result = {
      provider: 'piapi',
      model: 'Qubico/image-toolkit',
      task_type: 'background-remove',
      task_id: task.task_id,
      saved: [destPath],
      status: task.status,
    };

    if (format === 'json') {
      console.log(formatOutput(result, format));
    } else if (config.quiet) {
      console.log(destPath);
    } else {
      console.log(formatOutput(result, format));
    }
  },
});
