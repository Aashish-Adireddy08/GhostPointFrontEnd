import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {build} from 'vite';

const {version} = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const builtAt = new Date().toISOString();
await build({define: {'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(commit)}});
writeFileSync(new URL('../dist/version.json', import.meta.url), JSON.stringify({version, commit, builtAt}, null, 2) + '\n');
