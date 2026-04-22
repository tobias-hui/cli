import { CLIError } from '../../errors/base';
import { ExitCode } from '../../errors/codes';
import type { SubmitTaskBody } from './types';

const ALLOWED_RMBG_MODELS = new Set(['RMBG-1.4', 'RMBG-2.0', 'BEN2']);

export interface RemoveBgFlags {
  image: string;
  rmbgModel?: string;
}

export function buildRemoveBgTask(flags: RemoveBgFlags): SubmitTaskBody {
  if (!flags.image.startsWith('http')) {
    throw new CLIError(
      `--image must be a URL (got: ${flags.image})`,
      ExitCode.USAGE,
      'Upload the image to a public URL first (PiAPI does not accept local files or data URIs).',
    );
  }

  if (flags.rmbgModel && !ALLOWED_RMBG_MODELS.has(flags.rmbgModel)) {
    throw new CLIError(
      `Invalid --rmbg-model: ${flags.rmbgModel}. Allowed: ${[...ALLOWED_RMBG_MODELS].join(', ')}`,
      ExitCode.USAGE,
    );
  }

  const input: Record<string, unknown> = { image: flags.image };
  if (flags.rmbgModel) input.rmbg_model = flags.rmbgModel;

  return {
    model: 'Qubico/image-toolkit',
    task_type: 'background-remove',
    input,
  };
}
