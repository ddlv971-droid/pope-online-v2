
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { withClient } from '../db/index.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.resolve(__dirname, '../storage/ephemeral');
fs.mkdirSync(storageDir, { recursive: true });

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const AI_ANALYZABLE_TYPES = ['text/plain', 'text/csv', 'application/msword', 'application/pdf'];
const ALLOWED_UPLOAD_TYPES = ['text/plain', 'text/csv', 'application/msword', 'application/pdf'];
const ALLOWED_EXTENSIONS = ['.txt', '.csv', '.doc', '.pdf'];


function safeName(name='document') {
  return String(name || 'document').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || 'document';
}

function extensionOf(name='') {
  return path.extname(String(name || '')).toLowerCase();
}

function inferTypeFromName(name='') {
  const ext = extensionOf(name);
  if (ext === '.txt') return 'text/plain';
  if (ext === '.csv') return 'text/csv';
  if (ext === '.doc') return 'application/msword';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

function normalizeUploadType(name='', type='') {
  const normalizedType = String(type || '').trim().toLowerCase();
  const ext = extensionOf(name);
  const inferred = inferTypeFromName(name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) return { ok: false, ext, type: normalizedType || inferred };
  if (!normalizedType || normalizedType === 'application/octet-stream') return { ok: true, ext, type: inferred };
  if (!ALLOWED_UPLOAD_TYPES.includes(normalizedType)) return { ok: false, ext, type: normalizedType };
  return { ok: true, ext, type: normalizedType };
}


function cleanExtractedText(raw = '') {
  return String(raw || '')
    .replace(/\u0000/g, ' ')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 20000);
}

function decodePdfString(value = '') {
  return String(value || '')
    .replace(/\\([nrtbf()\\])/g, (_, ch) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' }[ch] || ch))
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

function extractTextFromPdf(buffer) {
  const source = buffer.toString('latin1');
  const parts = [];

  const directStrings = source.match(/\((?:\\.|[^\\)]){1,1200}\)\s*Tj/g) || [];
  for (const match of directStrings) {
    const body = match.replace(/\)\s*Tj$/, '').replace(/^\(/, '');
    const decoded = cleanExtractedText(decodePdfString(body));
    if (decoded) parts.push(decoded);
  }

  const arrayMatches = source.match(/\[(?:.|\n|\r){1,4000}?\]\s*TJ/g) || [];
  for (const match of arrayMatches) {
    const strMatches = match.match(/\((?:\\.|[^\\)]){1,1200}\)/g) || [];
    const joined = cleanExtractedText(strMatches.map((s) => decodePdfString(s.slice(1, -1))).join(' '));
    if (joined) parts.push(joined);
  }

  const hexMatches = source.match(/<([0-9A-Fa-f]{8,})>\s*Tj/g) || [];
  for (const match of hexMatches) {
    const hex = (match.match(/<([0-9A-Fa-f]{8,})>/) || [null, ''])[1];
    try {
      const decoded = cleanExtractedText(Buffer.from(hex, 'hex').toString('utf8'));
      if (decoded) parts.push(decoded);
    } catch {}
  }

  if (!parts.length) {
    const fallback = source
      .replace(/[^\x20-\x7E\n\r\tÀ-ÿ]/g, ' ')
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 20);
    if (fallback.length) parts.push(fallback.join('\n'));
  }

  return cleanExtractedText(parts.join('\n\n'));
}

function extractTextFromDoc(buffer) {
  const source = buffer.toString('latin1');
  const lines = source
    .replace(/\u0000/g, ' ')
    .replace(/[^\x20-\x7E\n\r\tÀ-ÿ]/g, ' ')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 20);
  return cleanExtractedText(lines.join('\n'));
}

function extractTextForAi(file) {
  try {
    const buffer = fs.readFileSync(file.path);
    const mime = String(file.type || '').toLowerCase();
    if (mime === 'text/plain' || mime === 'text/csv') {
      return cleanExtractedText(buffer.toString('utf8'));
    }
    if (mime === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
      return extractTextFromPdf(buffer);
    }
    if (mime === 'application/msword' || file.name?.toLowerCase().endsWith('.doc')) {
      return extractTextFromDoc(buffer);
    }
    return '';
  } catch {
    return '';
  }
}

function cleanupStoredFile(storedName) {
  if (!storedName) return;
  const target = path.join(storageDir, storedName);
  try { fs.unlinkSync(target); } catch {}
}

async function purgeExpired(client) {
  const expired = await client.query(`delete from ephemeral_files where expires_at <= now() returning stored_name`);
  for (const row of expired.rows) cleanupStoredFile(row.stored_name);
}

async function listFiles(client, userId) {
  await purgeExpired(client);
  const q = await client.query(
    `select id, direction, purpose, original_name, mime_type, size_bytes, created_at, expires_at
       from ephemeral_files
      where user_id=$1 and expires_at > now()
      order by created_at desc`,
    [userId]
  );
  return q.rows.map((row) => ({
    id: row.id,
    direction: row.direction,
    purpose: row.purpose,
    name: row.original_name,
    type: row.mime_type,
    size: Number(row.size_bytes || 0),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    canFeedAI: AI_ANALYZABLE_TYPES.includes(String(row.mime_type || '').toLowerCase())
  }));
}

export async function getUserVaultFiles(client, userId, ids = []) {
  await purgeExpired(client);
  if (!Array.isArray(ids) || !ids.length) return [];
  const q = await client.query(
    `select id, original_name, stored_name, mime_type, size_bytes, created_at, expires_at
       from ephemeral_files
      where user_id=$1 and id = any($2::uuid[]) and expires_at > now()
      order by created_at desc`,
    [userId, ids]
  );
  return q.rows.map((row) => ({
    id: row.id,
    name: row.original_name,
    storedName: row.stored_name,
    type: row.mime_type || 'application/octet-stream',
    size: Number(row.size_bytes || 0),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    path: path.join(storageDir, row.stored_name),
    canFeedAI: AI_ANALYZABLE_TYPES.includes(String(row.mime_type || '').toLowerCase())
  }));
}

export function buildMailAttachments(files = []) {
  const out = [];
  for (const file of files) {
    try {
      const content = fs.readFileSync(file.path).toString('base64');
      out.push({
        filename: safeName(file.name),
        content,
        type: file.type,
        disposition: 'attachment'
      });
    } catch {}
  }
  return out;
}

export function buildAiFileContext(files = []) {
  const parts = [];
  const unreadable = [];
  for (const file of files) {
    if (!file.canFeedAI) {
      unreadable.push(file.name);
      continue;
    }
    const extracted = extractTextForAi(file);
    if (extracted) {
      parts.push(`PIÈCE JOINTE ANALYSÉE: ${file.name}\n${extracted}`);
    } else {
      unreadable.push(file.name);
    }
  }
  if (unreadable.length) {
    parts.push(`PIÈCES JOINTES NON ANALYSÉES AUTOMATIQUEMENT : ${unreadable.join(', ')}`);
  }
  return parts.join('\n\n');
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const items = await withClient(async (client) => listFiles(client, req.user.sub));
    return res.json({ items, ttl_hours: 48 });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/upload', requireAuth, async (req, res) => {
  try {
    const name = safeName(req.body?.name || 'document');
    const requestedType = String(req.body?.type || 'application/octet-stream').slice(0, 120);
    const purpose = String(req.body?.purpose || 'general').slice(0, 120);
    const direction = String(req.body?.direction || 'client_to_pope').slice(0, 40);
    const contentBase64 = String(req.body?.contentBase64 || '');
    const normalized = normalizeUploadType(name, requestedType);
    if (!normalized.ok) return res.status(400).json({ error: 'invalid_file_type' });
    const type = normalized.type;
    if (!contentBase64) return res.status(400).json({ error: 'missing_file' });
    const buffer = Buffer.from(contentBase64, 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'missing_file' });
    if (buffer.length > MAX_FILE_BYTES) return res.status(400).json({ error: 'file_too_large' });
    const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${name}`;
    fs.writeFileSync(path.join(storageDir, storedName), buffer);
    const item = await withClient(async (client) => {
      await purgeExpired(client);
      const q = await client.query(
        `insert into ephemeral_files(user_id, direction, purpose, original_name, stored_name, mime_type, size_bytes)
         values($1,$2,$3,$4,$5,$6,$7)
         returning id, direction, purpose, original_name, mime_type, size_bytes, created_at, expires_at`,
        [req.user.sub, direction, purpose, name, storedName, type, buffer.length]
      );
      const row = q.rows[0];
      return {
        id: row.id,
        direction: row.direction,
        purpose: row.purpose,
        name: row.original_name,
        type: row.mime_type,
        size: Number(row.size_bytes || 0),
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        canFeedAI: AI_ANALYZABLE_TYPES.includes(String(row.mime_type || '').toLowerCase())
      };
    });
    return res.json({ ok: true, item });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.get('/:id/download', requireAuth, async (req, res) => {
  try {
    const file = await withClient(async (client) => {
      await purgeExpired(client);
      const q = await client.query(
        `select original_name, stored_name, mime_type from ephemeral_files where id=$1 and user_id=$2 and expires_at > now() limit 1`,
        [req.params.id, req.user.sub]
      );
      return q.rows[0] || null;
    });
    if (!file) return res.status(404).json({ error: 'file_not_found' });
    const target = path.join(storageDir, file.stored_name);
    if (!fs.existsSync(target)) return res.status(404).json({ error: 'file_not_found' });
    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName(file.original_name)}"`);
    return fs.createReadStream(target).pipe(res);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await withClient(async (client) => {
      await purgeExpired(client);
      const q = await client.query(
        `delete from ephemeral_files where id=$1 and user_id=$2 returning stored_name`,
        [req.params.id, req.user.sub]
      );
      return q.rows[0] || null;
    });
    if (!deleted) return res.status(404).json({ error: 'file_not_found' });
    cleanupStoredFile(deleted.stored_name);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

router.post('/admin/share', requireAdmin, async (req, res) => {
  try {
    const userId = String(req.body?.userId || '').trim();
    const name = safeName(req.body?.name || 'document');
    const requestedType = String(req.body?.type || 'application/octet-stream').slice(0, 120);
    const purpose = String(req.body?.purpose || 'pope_share').slice(0, 120);
    const contentBase64 = String(req.body?.contentBase64 || '');
    if (!userId || !contentBase64) return res.status(400).json({ error: 'missing_file' });
    const normalized = normalizeUploadType(name, requestedType);
    if (!normalized.ok) return res.status(400).json({ error: 'invalid_file_type' });
    const type = normalized.type;
    const buffer = Buffer.from(contentBase64, 'base64');
    if (!buffer.length) return res.status(400).json({ error: 'missing_file' });
    if (buffer.length > MAX_FILE_BYTES) return res.status(400).json({ error: 'file_too_large' });
    const storedName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${name}`;
    fs.writeFileSync(path.join(storageDir, storedName), buffer);
    await withClient(async (client) => {
      await purgeExpired(client);
      await client.query(
        `insert into ephemeral_files(user_id, direction, purpose, original_name, stored_name, mime_type, size_bytes)
         values($1,'pope_to_client',$2,$3,$4,$5,$6)`,
        [userId, purpose, name, storedName, type, buffer.length]
      );
    });
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'server_error' });
  }
});

export default router;
