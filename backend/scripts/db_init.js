
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool } from '../db/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedAdmin() {
  const username = String(process.env.DEFAULT_ADMIN_USERNAME || '').trim();
  const password = String(process.env.DEFAULT_ADMIN_PASSWORD || '').trim();
  const email = String(process.env.DEFAULT_ADMIN_EMAIL || '').trim();

  if (!username || !password || !email) {
    console.log('Admin seed skipped: DEFAULT_ADMIN_USERNAME / DEFAULT_ADMIN_PASSWORD / DEFAULT_ADMIN_EMAIL must be set explicitly.');
    return;
  }
  const existing = await pool.query('select id from users where email=$1 or upper(full_name)=upper($2) limit 1', [email, username]);
  if (existing.rowCount) return;
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `insert into users(email, password_hash, full_name, organization, account_space, is_email_verified, role, must_change_password)
     values($1,$2,$3,$4,'public',true,'admin',true)`,
    [email, hash, username, 'Administration POPE Online']
  );
  console.log('✅ Default admin account seeded');
}

async function main() {
  // Schéma principal
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('✅ DB schema applied');

  // Patch V22 — table deleted_accounts + sync tickets_expert
  // Idempotent : IF NOT EXISTS + UPDATE ciblé
  const patchPath = path.join(__dirname, '..', 'db', 'schema_patch_v22.sql');
  if (fs.existsSync(patchPath)) {
    const patch = fs.readFileSync(patchPath, 'utf8');
    await pool.query(patch);
    console.log('✅ DB patch v22 applied (deleted_accounts + tickets_expert sync)');
  }

  await seedAdmin();
  await pool.end();
}

main().catch((e) => {
  console.error('❌ DB init failed:', e);
  process.exit(1);
});
