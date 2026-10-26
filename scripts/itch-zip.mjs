// Builds the itch.io version and zips it for a manual upload: `npm run itch:zip` -> itch/orders-of-magnitude-web.zip.
// Uses the system tar (bsdtar on Windows 10+, macOS) to write the zip, so paths inside use forward slashes.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const run = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { stdio: 'inherit', shell: cmd === 'npm', ...opts }); if (r.status) process.exit(r.status ?? 1); };
if (!process.argv.includes('--no-build')) run('npm', ['run', 'itch']);
const zip = path.resolve('itch/orders-of-magnitude-web.zip');
fs.rmSync(zip, { force: true });
const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32', 'tar.exe') : 'tar';
run(tar, ['-a', '-c', '-f', zip, '*'], { cwd: 'itch/game', shell: process.platform !== 'win32' });
console.log(`zipped itch/game to ${path.relative('.', zip)} (${(fs.statSync(zip).size/1024).toFixed(0)} KB)`);
