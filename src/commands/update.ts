import { defineCommand } from '../command';

const CLI_VERSION = process.env.CLI_VERSION ?? '0.0.0';

export default defineCommand({
  name: 'update',
  description: 'Update pimx to the latest version',
  usage: 'pimx update',
  examples: [
    'pimx update',
  ],
  async run() {
    process.stderr.write(`Current version: ${CLI_VERSION}\n\n`);
    process.stderr.write('Run:\n');
    process.stderr.write('  npm update -g pimx-cli\n\n');
  },
});
