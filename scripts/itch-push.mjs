// Builds the itch.io version and uploads it with butler, itch's own uploader: `npm run itch:push`.
// The target is ITCH_TARGET (user/game), the browser channel html5. butler needs a login once:
// `butler login`, or an API key from itch.io/user/settings/api-keys in BUTLER_API_KEY.
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const target = process.env.ITCH_TARGET || 'matteodevi/orders-of-magnitude';
const local = path.join(os.homedir(), '.butler', process.platform === 'win32' ? 'butler.exe' : 'butler');
const butler = fs.existsSync(local) ? local : 'butler';
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'inherit', shell: cmd === 'npm' }); if (r.status) process.exit(r.status ?? 1); };

run('npm', ['run', 'itch']);
const rev = execSync('git rev-parse --short HEAD').toString().trim();
const ver = `${JSON.parse(fs.readFileSync('package.json', 'utf8')).version}+${rev}`;
console.log(`pushing itch/game to ${target}:html5 as ${ver}`);
run(butler, ['push', 'itch/game', `${target}:html5`, '--userversion', ver]);
