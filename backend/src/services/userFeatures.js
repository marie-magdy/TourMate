import pool from '../db.js';

export const FREE_CHAT_LIMIT = 15;
export const FREE_PLAN_COACH_LIMIT = 5;
export const PRO_CHAT_LIMIT = 9999;
export const PRO_PLAN_COACH_LIMIT = 9999;
export const PRO_PRICE_EGP = 99;

const USER_FEATURE_COLUMNS = `
  id,
  role,
  COALESCE(is_pro, false) AS is_pro,
  COALESCE(voice_chat_enabled, false) AS voice_chat_enabled,
  COALESCE(cv_enabled, false) AS cv_enabled,
  COALESCE(ar_enabled, false) AS ar_enabled,
  COALESCE(chat_uses_today, 0) AS chat_uses_today,
  chat_reset_date,
  COALESCE(plan_coach_uses_today, 0) AS plan_coach_uses_today,
  plan_coach_reset_date
`;

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function resetDailyCountersIfNeeded(row) {
  const today = todayDateString();
  let chatUses = Number(row.chat_uses_today ?? 0);
  let planCoachUses = Number(row.plan_coach_uses_today ?? 0);
  const chatReset = row.chat_reset_date
    ? String(row.chat_reset_date).slice(0, 10)
    : null;
  const coachReset = row.plan_coach_reset_date
    ? String(row.plan_coach_reset_date).slice(0, 10)
    : null;
  if (chatReset !== today) chatUses = 0;
  if (coachReset !== today) planCoachUses = 0;
  return { chatUses, planCoachUses, today };
}

/** @param {Record<string, unknown>} row */
export function buildFeaturesPayload(row) {
  const isPro = Boolean(row.is_pro) || row.role === 'admin';
  const { chatUses, planCoachUses } = resetDailyCountersIfNeeded(row);

  const voice = isPro || Boolean(row.voice_chat_enabled);
  const cv = isPro || Boolean(row.cv_enabled);
  const ar = isPro || Boolean(row.ar_enabled);

  const chatLimit = isPro ? PRO_CHAT_LIMIT : FREE_CHAT_LIMIT;
  const planCoachLimit = isPro ? PRO_PLAN_COACH_LIMIT : FREE_PLAN_COACH_LIMIT;

  return {
    is_pro: isPro,
    voice_chat_enabled: voice,
    cv_enabled: cv,
    ar_enabled: ar,
    voice,
    cv,
    ar,
    chat_limit: chatLimit,
    chat_used_today: chatUses,
    chat_remaining: Math.max(0, chatLimit - chatUses),
    plan_coach_limit: planCoachLimit,
    plan_coach_used_today: planCoachUses,
    plan_coach_remaining: Math.max(0, planCoachLimit - planCoachUses),
  };
}

export async function ensureProSchema() {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS cv_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS ar_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_uses_today INT DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS chat_reset_date DATE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_coach_uses_today INT DEFAULT 0;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_coach_reset_date DATE;
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscription_events (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'tourmate_pro',
      amount_egp NUMERIC(10, 2) DEFAULT 99,
      payment_method TEXT DEFAULT 'demo_card',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

export async function fetchUserFeatureRow(userId) {
  const result = await pool.query(
    `SELECT ${USER_FEATURE_COLUMNS} FROM users WHERE id = $1`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function getUserFeatures(userId) {
  const row = await fetchUserFeatureRow(userId);
  if (!row) return null;
  return buildFeaturesPayload(row);
}

async function syncDailyCounters(userId, row) {
  const { chatUses, planCoachUses, today } = resetDailyCountersIfNeeded(row);
  const chatReset = row.chat_reset_date
    ? String(row.chat_reset_date).slice(0, 10)
    : null;
  const coachReset = row.plan_coach_reset_date
    ? String(row.plan_coach_reset_date).slice(0, 10)
    : null;

  if (chatReset !== today || coachReset !== today) {
    await pool.query(
      `UPDATE users SET
         chat_uses_today = CASE WHEN chat_reset_date IS DISTINCT FROM $2::date THEN 0 ELSE chat_uses_today END,
         chat_reset_date = $2::date,
         plan_coach_uses_today = CASE WHEN plan_coach_reset_date IS DISTINCT FROM $2::date THEN 0 ELSE plan_coach_uses_today END,
         plan_coach_reset_date = $2::date
       WHERE id = $1`,
      [userId, today],
    );
    const refreshed = await fetchUserFeatureRow(userId);
    return refreshed ?? row;
  }
  return row;
}

/**
 * @param {number} userId
 * @param {'voice'|'cv'|'ar'|'chat'|'plan_coach'} feature
 */
export async function assertFeatureAccess(userId, feature) {
  if (!userId) {
    return { allowed: false, status: 400, error: 'user_id required' };
  }
  let row = await fetchUserFeatureRow(userId);
  if (!row) {
    return { allowed: false, status: 404, error: 'User not found' };
  }
  row = await syncDailyCounters(userId, row);
  const features = buildFeaturesPayload(row);

  if (feature === 'voice' && !features.voice) {
    return {
      allowed: false,
      status: 403,
      error: 'Voice chat requires TourMate Pro',
      code: 'PRO_REQUIRED',
      features,
    };
  }
  if (feature === 'cv' && !features.cv) {
    return {
      allowed: false,
      status: 403,
      error: 'Landmark recognition requires TourMate Pro',
      code: 'PRO_REQUIRED',
      features,
    };
  }
  if (feature === 'ar' && !features.ar) {
    return {
      allowed: false,
      status: 403,
      error: 'AR glasses mode requires TourMate Pro',
      code: 'PRO_REQUIRED',
      features,
    };
  }
  if (feature === 'chat') {
    if (features.chat_remaining <= 0) {
      return {
        allowed: false,
        status: 403,
        error: `Daily chat limit reached (${features.chat_limit}/day). Upgrade to TourMate Pro.`,
        code: 'CHAT_LIMIT',
        features,
      };
    }
    const today = todayDateString();
    await pool.query(
      `UPDATE users SET
         chat_uses_today = CASE WHEN chat_reset_date IS DISTINCT FROM $2::date THEN 1 ELSE chat_uses_today + 1 END,
         chat_reset_date = $2::date
       WHERE id = $1`,
      [userId, today],
    );
    const updated = await getUserFeatures(userId);
    return { allowed: true, features: updated };
  }
  if (feature === 'plan_coach') {
    if (features.plan_coach_remaining <= 0) {
      return {
        allowed: false,
        status: 403,
        error: `Daily plan coach limit reached (${features.plan_coach_limit}/day). Upgrade to TourMate Pro.`,
        code: 'PLAN_COACH_LIMIT',
        features,
      };
    }
    const today = todayDateString();
    await pool.query(
      `UPDATE users SET
         plan_coach_uses_today = CASE WHEN plan_coach_reset_date IS DISTINCT FROM $2::date THEN 1 ELSE plan_coach_uses_today + 1 END,
         plan_coach_reset_date = $2::date
       WHERE id = $1`,
      [userId, today],
    );
    const updated = await getUserFeatures(userId);
    return { allowed: true, features: updated };
  }

  return { allowed: true, features };
}

function validatePaymentCard({ cardNumber, expiry, cvv }) {
  const digits = String(cardNumber ?? '').replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) {
    return 'Please enter a valid card number (13–19 digits).';
  }
  const cvvDigits = String(cvv ?? '').replace(/\D/g, '');
  if (cvvDigits.length < 3 || cvvDigits.length > 4) {
    return 'Please enter a valid security code (CVV).';
  }
  const exp = String(expiry ?? '').replace(/\s/g, '');
  const m = exp.match(/^(\d{2})\/?(\d{2})$/);
  if (!m) return 'Please enter expiry as MM/YY.';
  const month = parseInt(m[1], 10);
  const year = 2000 + parseInt(m[2], 10);
  if (month < 1 || month > 12) return 'Invalid expiry month.';
  const now = new Date();
  const expEnd = new Date(year, month, 0, 23, 59, 59);
  if (expEnd < now) return 'This card has expired.';
  return null;
}

export async function upgradeUserToPro(
  userId,
  { cardNumber, expiry, cvv, paymentMethod = 'card' } = {},
) {
  const validationError = validatePaymentCard({ cardNumber, expiry, cvv });
  if (validationError) {
    return { success: false, status: 400, message: validationError };
  }

  const row = await fetchUserFeatureRow(userId);
  if (!row) return { success: false, status: 404, message: 'User not found' };
  if (row.is_pro || row.role === 'admin') {
    return { success: true, message: 'Already TourMate Pro', features: buildFeaturesPayload(row) };
  }

  await pool.query('UPDATE users SET is_pro = TRUE WHERE id = $1', [userId]);
  await pool.query(
    `INSERT INTO subscription_events (user_id, plan, amount_egp, payment_method)
     VALUES ($1, 'tourmate_pro', $2, $3)`,
    [userId, PRO_PRICE_EGP, paymentMethod],
  );

  const features = await getUserFeatures(userId);
  return { success: true, message: 'Welcome to TourMate Pro!', features };
}
