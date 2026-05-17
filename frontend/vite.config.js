import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync, statSync, readFileSync } from 'node:fs';

const ROOT = resolve(__dirname);

// Exclure les fichiers HTML legacy/deprecated du build Vite
const EXCLUDED_HTML = new Set([
  'app2.html','app2-private.html','dashboard2.html','dashboard2-private.html',
  'vault2.html','offre-gratuite.html','parcours.html','private-onboarding.html',
  // Fichiers legacy v1 — ne plus inclure dans le build prod
  'closier.html',
]);

function isCompiledOutput(fp) {
  try { return /assets\/\S+-[A-Za-z0-9]{3,8}\.(js|css)/.test(readFileSync(fp,'utf8')); }
  catch(_) { return false; }
}

function htmlInputs(dir) {
  const entries = {};
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isFile() && name.endsWith('.html')
        && !EXCLUDED_HTML.has(name) && !isCompiledOutput(full)) {
      entries[name.replace(/\.html$/i, '')] = full;
    }
  }
  return entries;
}

export default defineConfig(({ mode }) => ({
  root: ROOT,
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: htmlInputs(ROOT),
      output: {
        // Eviter que api.js soit extrait en chunk separe
        // qui peut etre bloque par certains proxies/firewalls
        manualChunks: (id) => {
          // Chunk partagé stable pour éviter que app.js finisse dans cgu
          if (id.includes('/app.js') || id.includes('/api.js') ||
              id.includes('/archive.js') || id.includes('/turnstile.js') ||
              id.includes('/phone.js')) {
            return 'shared';
          }
          // Pages légales uniquement (exclure referral, vault, profile, app-page)
          if ((id.includes('cgu') || id.includes('cgv') ||
               id.includes('privacy') || id.includes('resiliation') ||
               id.includes('legal')) &&
              !id.includes('referral') && !id.includes('vault') &&
              !id.includes('profile') && !id.includes('app-page')) {
            return 'legal-pages';
          }
        }
      }
    }
  },
  server: {
    host: true,
    port: mode === 'staging' ? 4174 : 4173
  }
}));
