import JavaScriptObfuscator from 'javascript-obfuscator';
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

// The built page lands in public/, which Firebase Hosting serves as-is.
export default defineConfig(({ mode }) => ({
  publicDir: false,
  plugins: mode === 'test' ? [] : [obfuscate()],
  build: { outDir: 'public', emptyOutDir: true, target: 'es2022', minify: mode !== 'test', sourcemap: false },
}));
