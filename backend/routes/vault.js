
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
const SAFE_TEXT_TYPES = ['text/plain','text/markdown','application/json','text/csv','text/html','application/xml','text/xml'];

function safeName(name='document') {
  return String(name || 'document').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || 'document';
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
    canFeedAI: SAFE_TEXT_TYPES.includes(String(row.mime_type || '').toLowerCase())
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
    canFeedAI: SAFE_TEXT_TYPES.includes(String(row.mime_type || '').toLowerCase())
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
  const nonText = [];
  for (const file of files) {
    if (!file.canFeedAI) {
      nonText.push(file.name);
      continue;
    }
    try {
      const raw = fs.readFileSync(file.path, 'utf8');
      const cleaned = String(raw || '').replace(/\u0000/g, '').slice(0, 12000);
      if (cleaned.trim()) {
        parts.push(`PIÈCE JOINTE: ${file.name}\n${cleaned}`);
      }
    } catch {}
  }
  if (nonText.length) {
    parts.push(`PIÈCES JOINTES NON ANALYSÉES AUTOMATIQUEMENT (formats non textuels) : ${nonText.join(', ')}`);
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
    const type = String(req.body?.type || 'application/octet-stream').slice(0, 120);
    const purpose = String(req.body?.purpose || 'general').slice(0, 120);
    const direction = String(req.body?.direction || 'client_to_pope').slice(0, 40);
    const contentBase64 = String(req.body?.contentBase64 || '');
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
        canFeedAI: SAFE_TEXT_TYPES.includes(String(row.mime_type || '').toLowerCase())
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
    const type = String(req.body?.type || 'application/octet-stream').slice(0, 120);
    const purpose = String(req.body?.purpose || 'pope_share').slice(0, 120);
    const contentBase64 = String(req.body?.contentBase64 || '');
    if (!userId || !contentBase64) return res.status(400).json({ error: 'missing_file' });
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
