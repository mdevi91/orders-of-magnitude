import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Release builds run the minified bundle through an obfuscator so it is hard to read back in devtools:
// renamed identifiers and an encoded, shuffled string table. Control-flow flattening and dead-code injection are
// left off because they slow the game's hot loops. Test builds skip all of this for readable stack traces.
const obfuscate = (): Plugin => ({
  name: 'obfuscate',
  apply: 'build',
  renderChunk(code){
    return JavaScriptObfuscator.obfuscate(code, {
      compact: true, target: 'browser', identifierNamesGenerator: 'hexadecimal', renameGlobals: false,
      stringArray: true, stringArrayEncoding: ['base64'], stringArrayThreshold: .75, stringArrayRotate: true, stringArrayShuffle: true,
      stringArrayWrappersCount: 2, stringArrayWrappersType: 'function', splitStrings: true, splitStringsChunkLength: 8,
      controlFlowFlattening: false, deadCodeInjection: false, selfDefending: false, debugProtection: false, sourceMap: false,
    }).getObfuscatedCode();
  },
});

// The dev server's end of the editor (mod-editor.html): its Save writes the sprites and labels to src/mods.json, keeping
// the version it replaces in editor-history/ (local only, never built); GET /__mods/history lists them, newest first.
const modSave = (): Plugin => ({
  name: 'mod-save',
  apply: 'serve',
  configureServer(server){
    const file = path.join(server.config.root, 'src', 'mods.json'), hist = path.join(server.config.root, 'editor-history');
    server.middlewares.use('/__mods', (req, res) => {
      if (req.method === 'GET' && req.url?.startsWith('/history')){
        const names = fs.existsSync(hist) ? fs.readdirSync(hist).filter(n => n.endsWith('.json')).sort().reverse() : [];
        const list = names.map(name => { try { return {name, ...JSON.parse(fs.readFileSync(path.join(hist, name), 'utf8'))}; } catch { return null; } }).filter(Boolean);
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(list)); return;
      }
      if (req.method !== 'POST'){ res.statusCode = 405; res.end(); return; }
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        try {
          const d = JSON.parse(body);
          if (typeof d.sprites !== 'object' || typeof d.labels !== 'object') throw new Error('expected {sprites, labels}');
          const old = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
          if (old && old.replace(/\s/g, '') !== body.replace(/\s/g, '')){
            fs.mkdirSync(hist, {recursive: true});
            fs.writeFileSync(path.join(hist, new Date().toISOString().replace(/[:.]/g, '-').slice(0, 23) + '.json'), old);
          }
          fs.writeFileSync(file, body.endsWith('\n') ? body : body + '\n');
          res.end('saved');
        } catch (e){ res.statusCode = 400; res.end(String(e)); }
      });
    });
  },
});

// The built page lands in public/, which Firebase Hosting serves as-is; the mod editor page stays a dev-only tool.
export default defineConfig(({ mode }) => ({
  publicDir: false,
  plugins: mode === 'test' ? [modSave()] : [obfuscate(), modSave()],
  build: { outDir: 'public', emptyOutDir: true, target: 'es2022', minify: mode !== 'test', sourcemap: false },
}));
