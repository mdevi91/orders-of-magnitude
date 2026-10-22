#!/usr/bin/env node
// Test runner: builds the game, injects each test/*.test.js into the game's own scope, runs it in headless Chrome
// and reports the checks it made. Usage: node test/run.js [name ...]   (CHROME=/path/to/chrome to pick a browser)
const fs = require('fs'), path = require('path'), os = require('os'), { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const build = spawnSync('bash', ['build.sh', 'src/orders-of-magnitude.html'], { cwd: root, encoding: 'utf8' });
if (build.status !== 0){ console.error(build.stdout + build.stderr); process.exit(1); }

const chrome = [process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find(p => p && fs.existsSync(p));
if (!chrome){ console.error('No Chrome found: set CHROME=/path/to/chrome'); process.exit(1); }

const page = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const hook = 'requestAnimationFrame(frame);\n})();';
if (!page.includes(hook)){ console.error('Injection point not found in public/index.html'); process.exit(1); }
const prelude = fs.readFileSync(path.join(__dirname, 'prelude.js'), 'utf8');

const want = process.argv.slice(2);
const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!want.length || want.some(w => f.startsWith(w))));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oom-test-'));
let failed = 0;
for (const f of files){
  const code = fs.readFileSync(path.join(__dirname, f), 'utf8');
  const html = page.replace(hook, `requestAnimationFrame(frame);\n${prelude}\nsetTimeout(() => { try {\n${code}\n} catch (e) { __fail('uncaught', e.stack); } __finish(); }, 0);\n})();`);
  const file = path.join(tmp, f.replace('.js', '.html'));
  fs.writeFileSync(file, html);
  const t0 = Date.now();
  const r = spawnSync(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${path.join(tmp, 'profile-' + f)}`,
    '--enable-logging=stderr', '--v=0', '--virtual-time-budget=600000', '--dump-dom', 'file:///' + file.replace(/\\/g, '/')],
    { encoding: 'utf8', timeout: 600000, maxBuffer: 1 << 26 });
  const line = (r.stderr || '').split('\n').find(l => l.includes('TESTRESULT '));
  const name = f.replace('.test.js', '');
  if (!line){ failed++; console.log(`✗ ${name}: no result (timed out or crashed)`); continue; }
  const json = line.slice(line.indexOf('TESTRESULT ') + 11).trim().replace(/", source: .*$/, '');
  const res = JSON.parse(json);
  const bad = res.checks.filter(c => !c.pass);
  failed += bad.length;
  console.log(`${bad.length ? '✗' : '✓'} ${name}: ${res.checks.length - bad.length}/${res.checks.length} checks, ${((Date.now()-t0)/1000).toFixed(1)} s`);
  for (const l of res.logs) console.log('    ' + l);
  for (const c of bad) console.log(`    FAIL ${c.name}${c.msg ? ': ' + c.msg : ''}`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} failing check(s)` : '\nAll tests passed');
process.exit(failed ? 1 : 0);
