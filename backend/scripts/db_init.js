
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool } from '../db/index.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyPatch(filename, label) {
  const p = path.join(__dirname, '..', 'db', filename);
  if (!fs.existsSync(p)) return;
  const sql = fs.readFileSync(p, 'utf8');
  await pool.query(sql);
  console.log(`✅ ${label}`);
}

async function seedAdmin() {
  const username = String(process.env.DEFAULT_ADMIN_USERNAME || '').trim();
  const password = String(process.env.DEFAULT_ADMIN_PASSWORD || '').trim();
  const email    = String(process.env.DEFAULT_ADMIN_EMAIL    || '').trim();

  if (!username || !password || !email) {
    console.log('ℹ️  Admin seed skipped (DEFAULT_ADMIN_* not set).');
    return;
  }

  const existing = await pool.query(
    'select id, role from users where email=$1 limit 1',
    [email]
  );

  if (existing.rowCount) {
    if (existing.rows[0].role !== 'admin') {
      await pool.query(
        `update users set role='admin', is_email_verified=true, must_change_password=false where id=$1`,
        [existing.rows[0].id]
      );
      console.log(`✅ Admin role promoted: ${email}`);
    } else {
      console.log(`ℹ️  Admin already set: ${email}`);
    }
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `insert into users(email, password_hash, full_name, organization, account_space, is_email_verified, role, must_change_password)
     values($1,$2,$3,$4,'public',true,'admin',true)`,
    [email, hash, username, 'Administration POPE Online']
  );
  console.log(`✅ Admin created: ${email}`);
}

async function main() {
  await applyPatch('schema.sql',           'DB schema applied');
  await applyPatch('schema_patch_v22.sql', 'Patch V22 applied (deleted_accounts + tickets_expert)');
  await applyPatch('schema_patch_v24.sql', 'Patch V24 applied (admin promotion + idempotent V22)');
  await applyPatch('schema_patch_v29.sql', 'Patch V29 applied (plans hybrides + IA illimitee)');
  await seedAdmin();
  await pool.end();
}

main().catch((e) => {
  console.error('❌ DB init failed:', e);
  process.exit(1);
});
