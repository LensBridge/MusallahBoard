/**
 * Regenerates src/api/schema.d.ts from the backend's OpenAPI contract.
 *
 * The spec lives in a different repository (LensBridge/LensBridgeBackend), so the
 * path is resolvable two ways:
 *   - locally: defaults to ../../LensBridgeBackend/openapi.yaml, matching a sibling
 *              checkout of MusallahBoard and LensBridgeBackend
 *   - in CI:   set OPENAPI_SPEC to wherever the backend was checked out
 *
 * Usage:
 *   node scripts/generate-api.mjs           regenerate in place
 *   node scripts/generate-api.mjs --check   fail if the committed schema is stale
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_SPEC = '../../LensBridgeBackend/openapi.yaml';
const OUT = 'src/api/schema.d.ts';

const spec = resolve(process.env.OPENAPI_SPEC ?? DEFAULT_SPEC);
const check = process.argv.includes('--check');

if (!existsSync(spec)) {
  console.error(`OpenAPI spec not found: ${spec}`);
  console.error('Check out LensBridgeBackend beside MusallahBoard, or set OPENAPI_SPEC.');
  process.exit(2);
}

const before = check && existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;

// Run the CLI's JS entry point with this same Node binary. Spawning `npx`
// would mean either shell:true (unescaped args) or npx.cmd, which Node refuses
// to spawn without a shell on Windows.
const require = createRequire(import.meta.url);
const cli = fileURLToPath(
  new URL('bin/cli.js', pathToFileURL(require.resolve('openapi-typescript/package.json')))
);
execFileSync(process.execPath, [cli, spec, '-o', OUT], { stdio: 'inherit' });

if (check) {
  const after = readFileSync(OUT, 'utf8');
  if (before !== after) {
    console.error(
      `\n${OUT} is out of date with ${spec}.\n` +
        'The backend contract changed but the generated client was not regenerated.\n' +
        'Run `npm run api:generate` and commit the result.'
    );
    process.exit(1);
  }
  console.log(`\n${OUT} is up to date with the committed spec.`);
}
