import { scanCommandPath, parseFlags } from './args';
import { registry } from './registry';
import { GLOBAL_OPTIONS } from './command';
import { handleError } from './errors/handler';
import { loadConfig, readConfigFile } from './config/loader';
import { detectRegion, saveDetectedRegion } from './config/detect-region';
import { REGIONS, type Region } from './config/schema';
import { checkForUpdate, getPendingUpdateNotification } from './update/checker';
import { loadCredentials } from './auth/credentials';
import { ensureApiKey } from './auth/setup';
import { findModel } from './providers/registry';

const CLI_VERSION = process.env.CLI_VERSION ?? '1.0.4';

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  process.stderr.write('\nInterrupted. Exiting.\n');
  process.exit(130);
});

// Handle stdout EPIPE gracefully (e.g., piped to `mpv` that exits early)
process.stdout.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EPIPE') process.exit(0);
  else throw e;
});

// Commands that manage their own auth or need no key
const NO_AUTH_SETUP = [
  ['auth', 'login'],
  ['auth', 'logout'],
  ['auth', 'status'],
  ['config', 'show'],
  ['config', 'set'],
  ['config', 'export-schema'],
  ['update'],
];

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--version') || argv.includes('-v')) {
    console.log(`pimx ${CLI_VERSION}`);
    process.exit(0);
  }

  const commandPath = scanCommandPath(argv, GLOBAL_OPTIONS);

  if (argv.includes('--help') || argv.includes('-h')) {
    const ri = argv.indexOf('--region');
    const region = ((ri >= 0 && argv[ri + 1]) || process.env.MINIMAX_REGION || readConfigFile().region || 'global') as Region;
    registry.printHelp(commandPath, process.stderr, region);
    process.exit(0);
  }

  // No command: help + quota (if logged in) or login guide
  if (commandPath.length === 0) {
    registry.printHelp([], process.stderr);

    const { command: quotaCmd } = registry.resolve(['quota', 'show']);
    const flags = parseFlags(argv, [...GLOBAL_OPTIONS, ...(quotaCmd.options ?? [])]);
    const config = loadConfig(flags);

    const hasKey = !!(config.apiKey || config.fileApiKey);
    const hasOAuth = !!(await loadCredentials());

    if (hasKey || hasOAuth) {
      await quotaCmd.execute(config, flags);
    } else {
      process.stderr.write('  Not logged in.\n');
      process.stderr.write('  pimx auth login --api-key sk-xxxxx\n\n');
    }
    process.exit(0);
  }

  const { command, extra } = registry.resolve(commandPath);
  const flags = parseFlags(argv, [...GLOBAL_OPTIONS, ...(command.options ?? [])]);

  if (extra.length > 0) (flags as Record<string, unknown>)._positional = extra;

  const config = loadConfig(flags);

  const needsAuthSetup = !NO_AUTH_SETUP.some(
    (cmd) => cmd.every((c, i) => commandPath[i] === c),
  );
  const usesMinimax = commandUsesMinimax(flags);
  if (needsAuthSetup && usesMinimax) {
    await ensureApiKey(config);
  }

  if (config.needsRegionDetection && usesMinimax) {
    const apiKey = config.apiKey || config.fileApiKey;
    if (apiKey) {
      const detected = await detectRegion(apiKey);
      config.region = detected;
      config.baseUrl = REGIONS[detected];
      config.needsRegionDetection = false;
      await saveDetectedRegion(detected);
    }
  }

  const updateCheckPromise = checkForUpdate(CLI_VERSION).catch(() => {});

  await command.execute(config, flags);

  await updateCheckPromise;
  const newVersion = getPendingUpdateNotification();
  if (newVersion && !config.quiet) {
    process.stderr.write(`\n  Update available: ${newVersion}\n`);
    process.stderr.write(`  npm update -g pimx-cli\n\n`);
  }
}

function commandUsesMinimax(flags: Record<string, unknown>): boolean {
  const provider = flags.provider;
  if (provider === 'piapi') return false;
  if (provider === 'minimax') return true;
  const model = typeof flags.model === 'string' ? flags.model : undefined;
  if (model) {
    const matches = findModel(model);
    if (matches.length === 1 && matches[0]!.provider === 'piapi') return false;
  }
  return true;
}

main().catch(handleError);
