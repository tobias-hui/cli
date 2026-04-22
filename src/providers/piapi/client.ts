import type { Config } from '../../config/schema';
import { CLIError } from '../../errors/base';
import { ExitCode } from '../../errors/codes';
import { createSpinner } from '../../output/progress';
import type {
  PiapiEnvelope, PiapiTask, SubmitTaskBody,
} from './types';

function getPiapiKey(config: Config): string {
  const key = config.providers?.piapi?.apiKey || process.env.PIAPI_API_KEY;
  if (!key) {
    throw new CLIError(
      'No PiAPI credentials configured.',
      ExitCode.AUTH,
      'Log in:        pimx auth login --provider piapi\nSet env var:   export PIAPI_API_KEY=...',
    );
  }
  return key;
}

function getPiapiBaseUrl(config: Config): string {
  return config.providers?.piapi?.baseUrl || 'https://api.piapi.ai';
}

async function piapiFetch<T>(
  config: Config,
  path: string,
  init: { method: string; body?: unknown },
): Promise<PiapiEnvelope<T>> {
  const url = `${getPiapiBaseUrl(config)}${path}`;
  const version = process.env.CLI_VERSION ?? 'dev';
  const res = await fetch(url, {
    method: init.method,
    headers: {
      'X-API-Key': getPiapiKey(config),
      'Content-Type': 'application/json',
      'User-Agent': `pimx-cli/${version}`,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout((config.timeout ?? 300) * 1000),
  });

  if (config.verbose) {
    process.stderr.write(`> ${init.method} ${url}\n`);
    process.stderr.write(`< ${res.status} ${res.statusText}\n`);
  }

  let body: PiapiEnvelope<T>;
  try {
    body = (await res.json()) as PiapiEnvelope<T>;
  } catch {
    throw new CLIError(
      `PiAPI returned non-JSON response (HTTP ${res.status}).`,
      ExitCode.GENERAL,
    );
  }

  if (!res.ok || body.code !== 200) {
    const msg = body.message || `HTTP ${res.status}`;
    throw new CLIError(
      `PiAPI error: ${msg}`,
      res.status === 401 ? ExitCode.AUTH : ExitCode.GENERAL,
    );
  }

  return body;
}

export async function submitTask<Output = unknown>(
  config: Config,
  req: SubmitTaskBody,
): Promise<PiapiTask<Output>> {
  const body = await piapiFetch<PiapiTask<Output>>(config, '/api/v1/task', {
    method: 'POST',
    body: req,
  });
  if (!body.data) throw new CLIError('PiAPI returned empty task payload.', ExitCode.GENERAL);
  return body.data;
}

export async function getTask<Output = unknown>(
  config: Config,
  taskId: string,
): Promise<PiapiTask<Output>> {
  const body = await piapiFetch<PiapiTask<Output>>(
    config,
    `/api/v1/task/${encodeURIComponent(taskId)}`,
    { method: 'GET' },
  );
  if (!body.data) throw new CLIError('PiAPI returned empty task payload.', ExitCode.GENERAL);
  return body.data;
}

/**
 * Submit + poll until terminal. Interval defaults to 5s; timeout follows config.timeout.
 */
export async function runTask<Output = unknown>(
  config: Config,
  req: SubmitTaskBody,
  opts?: { intervalSec?: number },
): Promise<PiapiTask<Output>> {
  const submitted = await submitTask<Output>(config, req);
  return waitForTask<Output>(config, submitted.task_id, opts);
}

export async function waitForTask<Output = unknown>(
  config: Config,
  taskId: string,
  opts?: { intervalSec?: number },
): Promise<PiapiTask<Output>> {
  const intervalSec = opts?.intervalSec ?? 5;
  const timeoutSec = config.timeout ?? 300;
  const deadline = Date.now() + timeoutSec * 1000;
  const spinner = createSpinner(`PiAPI task ${taskId.slice(0, 8)}...`);
  if (!config.quiet) spinner.start();

  try {
    while (Date.now() < deadline) {
      const task = await getTask<Output>(config, taskId);
      if (!config.quiet) spinner.update(`Status: ${task.status}`);

      if (task.status === 'completed') {
        spinner.stop('Done.');
        return task;
      }
      if (task.status === 'failed') {
        spinner.stop('Failed.');
        throw new CLIError(
          `PiAPI task failed: ${task.error?.message ?? 'unknown error'}`,
          ExitCode.GENERAL,
        );
      }
      await new Promise(r => setTimeout(r, intervalSec * 1000));
    }
  } finally {
    spinner.stop();
  }

  throw new CLIError(
    `PiAPI task timed out after ${timeoutSec}s.`,
    ExitCode.TIMEOUT,
    `Check status:  pimx task get ${taskId} --provider piapi`,
  );
}
