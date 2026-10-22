#!/usr/bin/env node
// Test runner: builds the game in test mode (which exposes every module as window.OOM), serves it locally,
// and runs each test/*.test.js in headless Chrome inside `with (OOM)`, so tests call the game's functions directly.
// Usage: node test/run.js [name ...]   (CHROME=/path/to/chrome to pick a browser)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oom-test-')), dist = path.join(tmp, 'dist');
const build = spawnSync('npx', ['vite', 'build', '--mode', 'test', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'], { cwd: root, encoding: 'utf8', shell: true });
if (build.status !== 0){ console.error(build.stdout + build.stderr); process.exit(1); }

const chrome = [process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(p => p && fs.existsSync(p));
if (!chrome){ console.error('No Chrome found: set CHROME=/path/to/chrome'); process.exit(1); }

const page = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const prelude = fs.readFileSync(path.join(here, 'prelude.js'), 'utf8');
const want = process.argv.slice(2);
const files = fs.readdirSync(here).filter(f => f.endsWith('.test.js') && (!want.length || want.some(w => f.startsWith(w))));
for (const f of files){
  const code = fs.readFileSync(path.join(here, f), 'utf8');
  // a classic script: waits for the game module, then runs prelude + test with every module export in scope
  const run = `<script>
function __run(){ with (OOM) {
${prelude}
try {
${code}
} catch (e) { __fail('uncaught', e.stack); }
__finish();
} }
const __wait = setInterval(() => { if (window.OOM){ clearInterval(__wait); setTimeout(__run, 0); } }, 10);
</script>`;
  fs.writeFileSync(path.join(dist, f.replace('.js', '.html')), page.replace('</body>', run + '\n</body>'));
}

const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(dist, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(dist) || !fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const runChrome = (url, profile) => new Promise(resolve => {
  const c = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`,
    '--enable-logging=stderr', '--v=0', '--virtual-time-budget=600000', '--dump-dom', url]);
  let err = ''; c.stderr.on('data', d => err += d); c.stdout.on('data', () => {});
  const kill = setTimeout(() => c.kill(), 600000);
  c.on('close', () => { clearTimeout(kill); resolve(err); });
});

let failed = 0;
for (const f of files){
  const name = f.replace('.test.js', ''), t0 = Date.now();
  const err = await runChrome(`http://127.0.0.1:${port}/${f.replace('.js', '.html')}`, path.join(tmp, 'profile-' + name));
  const line = err.split('\n').find(l => l.includes('TESTRESULT '));
  if (!line){
    failed++; console.log(`✗ ${name}: no result (timed out or crashed)`);
    for (const l of err.split('\n').filter(l => l.includes('CONSOLE')).slice(0, 5)) console.log('    ' + l.slice(0, 300));
    continue;
  }
  const res = JSON.parse(line.slice(line.indexOf('TESTRESULT ') + 11).trim().replace(/", source: .*$/, ''));
  const bad = res.checks.filter(c => !c.pass);
  failed += bad.length;
  console.log(`${bad.length ? '✗' : '✓'} ${name}: ${res.checks.length - bad.length}/${res.checks.length} checks, ${((Date.now()-t0)/1000).toFixed(1)} s`);
  for (const l of res.logs) console.log('    ' + l);
  for (const c of bad) console.log(`    FAIL ${c.name}${c.msg ? ': ' + c.msg : ''}`);
}
server.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} failing check(s)` : '\nAll tests passed');
process.exit(failed ? 1 : 0);
