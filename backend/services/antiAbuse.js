import { sha256Hex } from './security.js';

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function fpHash(fp) {
  return sha256Hex(fp || '');
}

// Decide if user should be marked suspicious, based on historical devices.
export async function computeSuspicion({ client, fp_hash, ip_hash, user_agent_hash }) {
  // Heuristics (MVP):
  // - if fp already used by another user AND that user is verified => suspicious
  // - if too many users from same ip_hash in last 24h => suspicious
  const fp = fp_hash;

  const fpRes = await client.query(
    `select d.user_id, u.is_email_verified
       from devices d
       join users u on u.id = d.user_id
      where d.fp_hash = $1
      limit 5`,
    [fp]
  );

  const fpSuspicious = fpRes.rows.some(r => r.is_email_verified);

  const ipRes = await client.query(
    `select count(distinct user_id) as c
       from devices
      where ip_hash = $1
        and first_seen_at > now() - interval '24 hours'`,
    [ip_hash]
  );
  const ipCount = Number(ipRes.rows?.[0]?.c || 0);
  const ipSuspicious = ipCount >= 3;

  // user agent hash used alone is too weak; kept for logging.
  return fpSuspicious || ipSuspicious;
}

export async function hasPriorFreeTrialOnFingerprint({ client, fp_hash }) {
  // if any user with same fp_hash has tickets_ai >= 3 at some point, we consider free trial already used.
  const r = await client.query(
    `select 1
       from devices d
       join wallets w on w.user_id = d.user_id
      where d.fp_hash = $1
        and w.tickets_ai >= 3
      limit 1`,
    [fp_hash]
  );
  return r.rowCount > 0;
}
