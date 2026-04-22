import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const VERSION = process.env.VERSION ?? pkg.version;
const OUT = 'dist/pimx.mjs';

await Bun.build({
  entrypoints: ['src/main.ts'],
  outdir: 'dist',
  naming: 'pimx.mjs',
  target: 'node',
  minify: true,
  define: { 'process.env.CLI_VERSION': JSON.stringify(VERSION) },
});

const content = readFileSync(OUT);
writeFileSync(OUT, Buffer.concat([Buffer.from('#!/usr/bin/env node\n'), content]));

const size = (content.length / 1024).toFixed(0);
console.log(`dist/pimx.mjs  ${size}KB`);
