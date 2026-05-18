// frontend/notifications.ts
import * as Notifications from 'expo-notifications';

// ── Configure how notifications appear when app is foregrounded ──────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

// ── Request permission from the user ─────────────────────────────────
export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Parse "HH:MM" time string into a Date object ─────────────────────
function timeStringToDate(timeStr: string, baseDate?: Date): Date {
  const base = baseDate ? new Date(baseDate) : new Date();
  const [hStr, mStr] = timeStr.split(':');
  base.setHours(parseInt(hStr, 10), parseInt(mStr ?? '0', 10), 0, 0);
  return base;
}

// ── Types ─────────────────────────────────────────────────────────────
export interface ScheduledActivity {
  id:       string;
  time:     string;
  title:    string;
  category: string;
}

// ── Schedule notifications for one day's itinerary ───────────────────
export async function scheduleItineraryNotifications(
  activities: ScheduledActivity[],
  planDate:   Date,
  advanceMin: number = 10,
): Promise<string[]> {
  const granted = await requestNotificationPermission();
  if (!granted) return [];

  const scheduledIds: string[] = [];
  const now = new Date();

  const realActivities = activities.filter(
    a => a.id !== 'start' && a.id !== 'end' && a.time && a.category !== 'transport'
  );

  for (let i = 0; i < realActivities.length; i++) {
    const activity     = realActivities[i];
    const activityDate = timeStringToDate(activity.time, planDate);

    // ── "Coming up" reminder X minutes before ────────────────────────
    const reminderTime = new Date(activityDate.getTime() - advanceMin * 60 * 1000);
    if (reminderTime > now) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `⏰ Coming up in ${advanceMin} min`,
          body:  `Next stop: ${activity.title}`,
          data:  { activityId: activity.id, type: 'reminder' },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminderTime,
        },
      });
      scheduledIds.push(id);
    }

    // ── "Time to go" at exact activity time ──────────────────────────
    if (activityDate > now) {
      const emoji = getCategoryEmoji(activity.category);
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `${emoji} Time for your next stop!`,
          body:  `Head to: ${activity.title}`,
          data:  { activityId: activity.id, type: 'now' },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: activityDate,
        },
      });
      scheduledIds.push(id);
    }

  }

  return scheduledIds;
}

// ── Cancel specific notifications ─────────────────────────────────────
export async function cancelItineraryNotifications(ids: string[]): Promise<void> {
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

// ── Cancel ALL notifications ──────────────────────────────────────────
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ── Helper ────────────────────────────────────────────────────────────
function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    breakfast:  '🍳',
    food:       '🍽',
    dinner:     '🌙',
    coffee:     '☕',
    attraction: '🏛',
    default:    '📍',
  };
  return map[category] ?? map['default'];
}
