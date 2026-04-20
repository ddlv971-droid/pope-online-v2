import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const ROOT = resolve(__dirname);

function htmlInputs(dir) {
  const entries = {};
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isFile() && name.endsWith('.html')) {
      entries[name.replace(/\.html$/i, '')] = full;
    }
  }
  return entries;
}

export default defineConfig(({ mode }) => ({
  root: ROOT,
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: htmlInputs(ROOT)
    }
  },
  server: {
    host: true,
    port: mode === 'staging' ? 4174 : 4173
  }
}));
