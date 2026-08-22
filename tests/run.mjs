/* ---------------------------------------------------------------------------
   IURS test runner.

   Run it with:   npm test        (or:  node tests/run.mjs)

   It runs the Worker against a real SQL engine (node:sqlite), not mocks, so the
   checks exercise genuine SQL behaviour. Requires Node.js 22 or newer, because
   node:sqlite does not exist in older versions. This is only for verification —
   it is NOT needed to deploy the website.
   --------------------------------------------------------------------------- */
import { copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

const major = Number(process.versions.node.split('.')[0]);
if (major < 22) {
  console.error('\nThese tests need Node.js 22 or newer (you have ' + process.versions.node + ').');
  console.error('The website itself is unaffected — this only stops the tests from running.\n');
  process.exit(1);
}

/* The Worker is written as an ES module. Copy it next to the tests as .mjs so
   Node loads it as a module without changing anything in the project. */
copyFileSync(path.join(root, 'src', 'index.js'), path.join(here, 'index.mjs'));
copyFileSync(path.join(root, 'src', 'seed.js'), path.join(here, 'seed.js'));

let failed = 0;
for (const suite of ['verify.mjs', 'verify-deploy.mjs']) {
  const r = spawnSync(process.execPath, [path.join(here, suite)], { stdio: 'inherit', cwd: here });
  if (r.status !== 0) failed++;
}

console.log('');
if (failed) {
  console.log('\x1b[31m' + failed + ' suite(s) reported a failure.\x1b[0m');
  process.exit(1);
}
console.log('\x1b[32mAll suites passed.\x1b[0m');
