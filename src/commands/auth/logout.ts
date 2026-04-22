import { defineCommand } from '../../command';
import { CLIError } from '../../errors/base';
import { ExitCode } from '../../errors/codes';
import { clearCredentials, loadCredentials } from '../../auth/credentials';
import { readConfigFile, writeConfigFile } from '../../config/loader';
import type { Config } from '../../config/schema';
import type { GlobalFlags } from '../../types/flags';

export default defineCommand({
  name: 'auth logout',
  description: 'Revoke tokens and clear stored credentials',
  usage: 'pimx auth logout [--provider <id>] [--yes] [--dry-run]',
  options: [
    { flag: '--provider <id>', description: 'Clear only this provider: minimax, piapi' },
    { flag: '--yes', description: 'Skip confirmation prompt' },
  ],
  examples: [
    'pimx auth logout',
    'pimx auth logout --provider piapi',
    'pimx auth logout --dry-run',
  ],
  async run(config: Config, flags: GlobalFlags) {
    const provider = flags.provider as string | undefined;
    if (provider && provider !== 'minimax' && provider !== 'piapi') {
      throw new CLIError(
        `Unknown provider: ${provider}`,
        ExitCode.USAGE,
        'Allowed: minimax, piapi',
      );
    }

    const clearMinimax = !provider || provider === 'minimax';
    const clearPiapi = !provider || provider === 'piapi';

    const creds = await loadCredentials();
    const fileConfig = readConfigFile() as Record<string, unknown>;
    const flatKey = typeof fileConfig.api_key === 'string' ? (fileConfig.api_key as string) : undefined;
    const providersObj = (fileConfig.providers as Record<string, unknown> | undefined);
    const hasNestedMinimax = !!(providersObj && typeof providersObj.minimax === 'object' && providersObj.minimax && 'api_key' in (providersObj.minimax as Record<string, unknown>));
    const hasNestedPiapi = !!(providersObj && typeof providersObj.piapi === 'object' && providersObj.piapi && 'api_key' in (providersObj.piapi as Record<string, unknown>));
    const hasConfigKey = !!flatKey || hasNestedMinimax;

    if (config.dryRun) {
      if (clearMinimax && creds) console.log('Would remove ~/.pimx/credentials.json');
      if (clearMinimax && hasConfigKey) console.log('Would clear minimax api_key from ~/.pimx/config.json');
      if (clearPiapi && hasNestedPiapi) console.log('Would clear piapi api_key from ~/.pimx/config.json');
      if (!creds && !hasConfigKey && !hasNestedPiapi) console.log('No credentials to clear.');
      console.log('No changes made.');
      return;
    }

    let changed = false;

    if (clearMinimax && creds) {
      await clearCredentials();
      process.stderr.write('Removed ~/.pimx/credentials.json\n');
      changed = true;
    }

    if ((clearMinimax && hasConfigKey) || (clearPiapi && hasNestedPiapi)) {
      try {
        const updated = fileConfig;
        if (clearMinimax) {
          delete updated.api_key;
          if (providersObj && typeof providersObj.minimax === 'object' && providersObj.minimax) {
            const mm = providersObj.minimax as Record<string, unknown>;
            delete mm.api_key;
            if (Object.keys(mm).length === 0) delete providersObj.minimax;
          }
        }
        if (clearPiapi && providersObj && typeof providersObj.piapi === 'object' && providersObj.piapi) {
          const pi = providersObj.piapi as Record<string, unknown>;
          delete pi.api_key;
          if (Object.keys(pi).length === 0) delete providersObj.piapi;
        }
        if (providersObj && Object.keys(providersObj).length === 0) {
          delete updated.providers;
        }
        await writeConfigFile(updated);
        if (clearMinimax && hasConfigKey) process.stderr.write('Cleared minimax api_key from ~/.pimx/config.json\n');
        if (clearPiapi && hasNestedPiapi) process.stderr.write('Cleared piapi api_key from ~/.pimx/config.json\n');
        changed = true;
      } catch { /* ignore */ }
    }

    if (!changed) {
      process.stderr.write('No credentials to clear.\n');
    }
  },
});
