import { defineConfig } from 'vite';

// The built page lands in public/, which Firebase Hosting serves as-is. Test builds stay unminified for readable stack traces.
export default defineConfig(({ mode }) => ({
  publicDir: false,
  build: { outDir: 'public', emptyOutDir: true, target: 'es2022', minify: mode !== 'test' },
}));
