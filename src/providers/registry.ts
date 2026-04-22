import { CLIError } from '../errors/base';
import { ExitCode } from '../errors/codes';
import type { ProviderId } from '../config/schema';

export type Capability = 'image' | 'video' | 'music' | 'speech' | 'text' | 'vision' | 'search';

export interface ModelEntry {
  model: string;
  provider: ProviderId;
  capability: Capability;
  /** PiAPI-style task_type; optional for providers that don't use tasks. */
  taskType?: string;
  description?: string;
}

/**
 * Single source of truth for model → provider routing.
 * MiniMax models listed for `pimx models` / auth-status display, even though
 * their command paths don't consult this table yet (they hardcode model names).
 */
export const MODELS: ModelEntry[] = [
  // MiniMax
  { model: 'image-01',              provider: 'minimax', capability: 'image', description: 'MiniMax image generation' },
  { model: 'image-01-live',         provider: 'minimax', capability: 'image', description: 'MiniMax image (live)' },
  { model: 'MiniMax-Hailuo-02',     provider: 'minimax', capability: 'video', description: 'MiniMax Hailuo video' },
  { model: 'music-1.5',             provider: 'minimax', capability: 'music', description: 'MiniMax music generation' },

  // PiAPI
  {
    model: 'nano-banana-pro',
    provider: 'piapi',
    capability: 'image',
    taskType: 'nano-banana-pro',
    description: 'Gemini 2.5 Flash image (PiAPI, task-based)',
  },
  {
    model: 'gpt-image-2-preview',
    provider: 'piapi',
    capability: 'image',
    description: 'OpenAI gpt-image-2 via PiAPI (synchronous, OpenAI-compatible)',
  },
];

export function findModel(model: string): ModelEntry[] {
  return MODELS.filter(m => m.model === model);
}

/**
 * Resolve the provider for a model. Explicit --provider wins. When multiple
 * providers claim the same model name, require --provider to disambiguate.
 */
export function resolveProvider(
  model: string,
  explicit?: ProviderId,
): { provider: ProviderId; entry?: ModelEntry } {
  const matches = findModel(model);

  if (explicit) {
    const entry = matches.find(m => m.provider === explicit);
    // Unknown model is fine when user asserts a provider — let the provider handle it.
    return { provider: explicit, entry };
  }

  if (matches.length === 0) {
    throw new CLIError(
      `Unknown model: ${model}`,
      ExitCode.USAGE,
      'List models:  pimx models\nOr specify:    --provider <minimax|piapi>',
    );
  }

  if (matches.length > 1) {
    const providers = matches.map(m => m.provider).join(', ');
    throw new CLIError(
      `Model '${model}' is offered by multiple providers (${providers}).`,
      ExitCode.USAGE,
      `Re-run with --provider <${matches.map(m => m.provider).join('|')}>`,
    );
  }

  return { provider: matches[0]!.provider, entry: matches[0] };
}

export function modelsByCapability(capability: Capability): ModelEntry[] {
  return MODELS.filter(m => m.capability === capability);
}

export function modelsByProvider(provider: ProviderId): ModelEntry[] {
  return MODELS.filter(m => m.provider === provider);
}
