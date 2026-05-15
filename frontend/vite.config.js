import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

const ROOT = resolve(__dirname);

// Fichiers HTML exclus du build Vite (legacy IIFE scripts non-modules)
const EXCLUDED_HTML = new Set([
  'account.html',
  'app2.html',
  'app2-private.html',
  'dashboard2.html',
  'dashboard2-private.html',
  'vault2.html',
  'offre-gratuite.html',
  'referral.html',
  'parcours.html',
  'private-onboarding.html',
]);

function htmlInputs(dir) {
  const entries = {};
  for (const name of readdirSync(dir)) {
    const full = resolve(dir, name);
    if (statSync(full).isFile() && name.endsWith('.html') && !EXCLUDED_HTML.has(name)) {
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
