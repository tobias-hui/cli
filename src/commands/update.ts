import { defineCommand } from '../command';
import { CLIError } from '../errors/base';
import { ExitCode } from '../errors/codes';
import { resolveUpdateTarget, applySelfUpdate, type Channel } from '../update/self-update';

const CLI_VERSION = process.env.CLI_VERSION ?? '0.1.0';

export default defineCommand({
  name: 'update',
  description: 'Update minimax to a newer version',
  usage: 'minimax update [stable|latest|VERSION]',
  options: [
    { flag: '[channel]', description: 'Target: stable (default), latest, or a version like 0.2.0' },
  ],
  examples: [
    'minimax update',
    'minimax update latest',
    'minimax update 0.2.0',
  ],
  async run(config, flags) {
    // Detect current binary path
    const currentBin = process.execPath;
    if (currentBin.endsWith('bun') || currentBin.endsWith('node')) {
      throw new CLIError(
        'Self-update is only supported for standalone binary installs.\n' +
        'For npm installs, run: npm update -g minimax-cli',
        ExitCode.USAGE,
      );
    }

    const rawChannel = (flags._positional as string[] | undefined)?.[0] ?? 'stable';
    const validChannels = new Set(['stable', 'latest']);
    const channel: Channel = validChannels.has(rawChannel) || /^\d/.test(rawChannel) || rawChannel.startsWith('v')
      ? rawChannel
      : (() => { throw new CLIError(`Unknown channel: ${rawChannel}`, ExitCode.USAGE); })();

    process.stderr.write(`Checking for updates (channel: ${channel})...\n`);
    const target = await resolveUpdateTarget(channel);

    if (target.version === `v${CLI_VERSION}`) {
      process.stderr.write(`Already up to date (${CLI_VERSION}).\n`);
      return;
    }

    process.stderr.write(`Update available: v${CLI_VERSION} → ${target.version}\n`);

    if (config.dryRun) {
      process.stderr.write(`Would replace: ${currentBin}\n`);
      return;
    }

    await applySelfUpdate(target, currentBin);

    process.stderr.write(`\nUpdated to ${target.version}.\n`);
    process.stderr.write(`https://github.com/MiniMax-AI-Dev/minimax-cli/releases/tag/${target.version}\n`);
  },
});
