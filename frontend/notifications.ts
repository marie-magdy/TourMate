// frontend/notifications.ts
//
// OS-level local notifications for itinerary activities.
// Two reminders per activity: "Coming up in N min" + "Time for your next stop!".
// Date-trigger scheduling means iOS/Android fire them even if the app is
// backgrounded, suspended, or killed — no background task required.

import * as Notifications from 'expo-notifications';

// ── Foreground display behaviour ─────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:  true,
    shouldPlaySound:  true,
    shouldSetBadge:   false,
    shouldShowBanner: true,
    shouldShowList:   true,
  }),
});

// ── Permission ───────────────────────────────────────────────────────
export async function askForNotificationPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.status === 'granted') return true;
    if (existing.status === 'denied')  return false;
    const { status } = await Notifications.requestPermissionsAsync({
      ios:     { allowAlert: true, allowBadge: true, allowSound: true },
      android: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return status === 'granted';
  } catch (err) {
    console.warn('[Notifications] permission request failed:', err);
    return false;
  }
}

// ── Types ────────────────────────────────────────────────────────────
export interface ScheduledActivity {
  id:       string;
  time:     string;   // "HH:MM"
  title:    string;
  category: string;
}

// ── Helpers ──────────────────────────────────────────────────────────
function timeStringToDate(timeStr: string, baseDate: Date): Date {
  const out = new Date(baseDate);
  const [hStr, mStr] = timeStr.split(':');
  out.setHours(parseInt(hStr, 10) || 0, parseInt(mStr ?? '0', 10) || 0, 0, 0);
  return out;
}

function getCategoryEmoji(category: string): string {
  const map: Record<string, string> = {
    breakfast:  '🍳',
    food:       '🍽',
    lunch:      '🍽',
    dinner:     '🌙',
    coffee:     '☕',
    snack:      '🍪',
    attraction: '🏛',
    transport:  '🚗',
  };
  return map[String(category || '').toLowerCase()] ?? '📍';
}

// ── Schedule ─────────────────────────────────────────────────────────
export async function scheduleItineraryNotifications(
  activities: ScheduledActivity[],
  planDate:   Date,
  advanceMin: number = 10,
): Promise<string[]> {
  const granted = await askForNotificationPermission();
  if (!granted) {
    console.warn('[Notifications] permission not granted, nothing scheduled');
    return [];
  }

  const scheduledIds: string[] = [];
  const now = new Date();

  const realActivities = activities.filter(
    a => a.id !== 'start' && a.id !== 'end' && a.time && a.category !== 'transport',
  );

  for (const activity of realActivities) {
    const activityDate = timeStringToDate(activity.time, planDate);

    // "Coming up" reminder N minutes before
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

    // "Time to go" at the exact activity time
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

// ── Cancel specific notifications ────────────────────────────────────
export async function cancelItineraryNotifications(ids: string[]): Promise<void> {
  for (const id of ids) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

// ── Cancel ALL notifications ─────────────────────────────────────────
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
