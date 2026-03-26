import { $ } from 'bun';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const VERSION = process.env.VERSION ?? 'dev';

const targets = [
  { bunTarget: 'bun-linux-x64',         platform: 'linux-x64',        output: 'minimax-linux-x64' },
  { bunTarget: 'bun-linux-x64-musl',    platform: 'linux-x64-musl',   output: 'minimax-linux-x64-musl' },
  { bunTarget: 'bun-linux-arm64',       platform: 'linux-arm64',      output: 'minimax-linux-arm64' },
  { bunTarget: 'bun-linux-arm64-musl',  platform: 'linux-arm64-musl', output: 'minimax-linux-arm64-musl' },
  { bunTarget: 'bun-darwin-x64',        platform: 'darwin-x64',       output: 'minimax-darwin-x64' },
  { bunTarget: 'bun-darwin-arm64',      platform: 'darwin-arm64',     output: 'minimax-darwin-arm64' },
  { bunTarget: 'bun-windows-x64',       platform: 'windows-x64',      output: 'minimax-windows-x64.exe' },
];

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

console.log(`Building minimax-cli ${VERSION}...\n`);

const manifest: {
  version: string;
  platforms: Record<string, { checksum: string }>;
} = { version: VERSION, platforms: {} };

for (const { bunTarget, platform, output } of targets) {
  const outPath = `dist/${output}`;
  process.stdout.write(`  ${output}...`);
  await $`bun build src/main.ts \
    --compile \
    --target ${bunTarget} \
    --outfile ${outPath} \
    --define "process.env.CLI_VERSION='${VERSION}'"`.quiet();
  manifest.platforms[platform] = { checksum: sha256(outPath) };
  console.log(' ✓');
}

writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
console.log('  manifest.json ✓');
console.log(`\nDone. ${targets.length} binaries in dist/`);
