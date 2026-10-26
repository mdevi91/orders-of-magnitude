// The itch.io half of `npm run release`: uploads with butler when it is logged in, otherwise just builds the zip for a manual upload.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const loggedIn = !!process.env.BUTLER_API_KEY || fs.existsSync(path.join(os.homedir(), '.config', 'itch', 'butler_creds'));
const r = spawnSync('npm', ['run', loggedIn ? 'itch:push' : 'itch:zip'], { stdio: 'inherit', shell: true });
if (!loggedIn) console.log('butler is not logged in, so upload itch/orders-of-magnitude-web.zip by hand (or run `butler login` once to automate it)');
process.exit(r.status ?? 1);
