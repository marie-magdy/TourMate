export interface UserFeatures {
  is_pro: boolean;
  voice_chat_enabled: boolean;
  cv_enabled: boolean;
  ar_enabled: boolean;
  voice: boolean;
  cv: boolean;
  ar: boolean;
  chat_limit: number;
  chat_used_today: number;
  chat_remaining: number;
  plan_coach_limit: number;
  plan_coach_used_today: number;
  plan_coach_remaining: number;
}

export const DEFAULT_FEATURES: UserFeatures = {
  is_pro: false,
  voice_chat_enabled: false,
  cv_enabled: false,
  ar_enabled: false,
  voice: false,
  cv: false,
  ar: false,
  chat_limit: 15,
  chat_used_today: 0,
  chat_remaining: 15,
  plan_coach_limit: 5,
  plan_coach_used_today: 0,
  plan_coach_remaining: 5,
};

export function parseFeaturesPayload(data: Partial<UserFeatures> | undefined): UserFeatures {
  if (!data) return { ...DEFAULT_FEATURES };
  return {
    is_pro: Boolean(data.is_pro),
    voice_chat_enabled: Boolean(data.voice_chat_enabled ?? data.voice),
    cv_enabled: Boolean(data.cv_enabled ?? data.cv),
    ar_enabled: Boolean(data.ar_enabled ?? data.ar),
    voice: Boolean(data.voice ?? data.voice_chat_enabled),
    cv: Boolean(data.cv ?? data.cv_enabled),
    ar: Boolean(data.ar ?? data.ar_enabled),
    chat_limit: Number(data.chat_limit ?? DEFAULT_FEATURES.chat_limit),
    chat_used_today: Number(data.chat_used_today ?? 0),
    chat_remaining: Number(data.chat_remaining ?? DEFAULT_FEATURES.chat_remaining),
    plan_coach_limit: Number(data.plan_coach_limit ?? DEFAULT_FEATURES.plan_coach_limit),
    plan_coach_used_today: Number(data.plan_coach_used_today ?? 0),
    plan_coach_remaining: Number(
      data.plan_coach_remaining ?? DEFAULT_FEATURES.plan_coach_remaining,
    ),
  };
}
