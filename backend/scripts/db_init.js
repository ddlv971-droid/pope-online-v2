<<<<<<< HEAD
=======

>>>>>>> 7bbf5523fa98ca38a268f527416bf281554fe2d1
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
<<<<<<< HEAD
  const shouldSeed = String(process.env.ALLOW_ADMIN_SEED || '').trim().toLowerCase() === 'true';
  if (!shouldSeed) {
    console.log('ℹ️ Création automatique du compte admin désactivée.');
    return;
  }
  const username = String(process.env.DEFAULT_ADMIN_USERNAME || '').trim();
  const password = String(process.env.DEFAULT_ADMIN_PASSWORD || '').trim();
  const email = String(process.env.DEFAULT_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!username || !password || !email) {
    throw new Error('ALLOW_ADMIN_SEED=true exige DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD et DEFAULT_ADMIN_EMAIL.');
  }
  const existing = await pool.query('select id from users where email=$1 limit 1', [email]);
=======
  const username = process.env.DEFAULT_ADMIN_USERNAME || 'POPADMIN';
  const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin';
  const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@pope-online.local';
  const existing = await pool.query('select id from users where email=$1 or upper(full_name)=upper($2) limit 1', [email, username]);
>>>>>>> 7bbf5523fa98ca38a268f527416bf281554fe2d1
  if (existing.rowCount) return;
  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `insert into users(email, password_hash, full_name, organization, account_space, is_email_verified, role, must_change_password)
     values($1,$2,$3,$4,'public',true,'admin',true)`,
    [email, hash, username, 'Administration POPE Online']
  );
<<<<<<< HEAD
  console.log('✅ Compte admin initial créé explicitement');
=======
  console.log('✅ Default admin account seeded');
>>>>>>> 7bbf5523fa98ca38a268f527416bf281554fe2d1
}

async function main() {
  const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('✅ DB schema applied');
  await seedAdmin();
  await pool.end();
}

main().catch((e) => {
  console.error('❌ DB init failed:', e);
  process.exit(1);
});
