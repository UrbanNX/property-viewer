import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Authoritative source; no forked schema or runtime network dependency.
const revision = 'c33b63887010f0b0de6c64ed9e895fa2677c05b8';
const root = mkdtempSync(join(tmpdir(), 'glb-project-'));
try {
  for (const file of ['glb.ts', 'project.ts', 'projectTypes.ts']) {
    const result = JSON.parse(execFileSync('gh', ['api', `repos/UrbanNX/urbanwave/contents/vibes/packages/glb-project/${file}?ref=${revision}`], { encoding: 'utf8', maxBuffer: 2e6 }));
    writeFileSync(join(root, file), Buffer.from(result.content, 'base64'));
  }
  await build({ absWorkingDir: root, entryPoints: ['glb.ts'], bundle: true, format: 'esm', target: ['safari15', 'chrome100'],
    outfile: join(process.cwd(), 'src/urbanwave-contract.js'),
    banner: { js: `// Generated from UrbanNX/urbanwave ${revision}, vibes/packages/glb-project/glb.ts.\n// Run node build-contract.mjs; do not edit or maintain a separate schema.` } });
} finally { rmSync(root, { recursive: true, force: true }); }
