/**
 * planNotifications.ts
 * 
 * Real-time notification system for active plans.
 * Sends notifications 5 minutes before each activity in the itinerary ends.
 * Works on iOS, Android, and web via Expo Notifications.
 */

import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';


// ── Types ────────────────────────────────────────────────────────────────────
export interface PlanActivityStep {
  id: string | number;
  name: string;
  type: 'Attraction' | 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | string;
  time: string;           // arrival time (HH:MM)
  departure_time?: string; // departure time (HH:MM)
  duration_hrs: number;
  travel_duration_min?: number;
  latitude?: number;
  longitude?: number;
}

export interface ActivePlan {
  id: string;
  userId: string;
  startDate: Date;
  activities: PlanActivityStep[];
}

// ── Manager Class ───────────────────────────────────────────────────────────
class PlanNotificationManager {
  private activePlan: ActivePlan | null = null;
  private trackingInterval: ReturnType<typeof setInterval> | null = null;
  private notificationTimer: Map<string | number, string> = new Map();
  private notifiedActivities: Set<string | number> = new Set();
  private NOTIFICATION_ADVANCE_MIN = 5; // 5 minutes before activity ends
  private appState = 'active';

  constructor() {
    // Track app state (foreground/background)
    AppState.addEventListener('change', this.handleAppStateChange);
  }

  /**
   * Start tracking an active plan
   */
  public async startTrackingPlan(plan: ActivePlan): Promise<void> {
    console.log('[PlanNotifications] Starting to track plan:', plan.id);
    console.log('[PlanNotifications] Plan start date:', plan.startDate);
    console.log('[PlanNotifications] Activities:', plan.activities.map(a => ({ name: a.name, time: a.time, duration: a.duration_hrs })));
    
    // Stop any existing tracking
    this.stopTrackingPlan();
    
    this.activePlan = plan;
    this.notifiedActivities.clear();
    
    // Schedule notifications for all future activities
    await this.scheduleAllFutureNotifications();
    
    // Start the main tracking loop
    this.trackingInterval = setInterval(
      () => this.checkAndNotify(),
      5000 // Check every 5 seconds for responsiveness
    );
    
    // Do an initial check
    this.checkAndNotify();
  }

  /**
   * Schedule notifications for all future activities
   */
  private async scheduleAllFutureNotifications(): Promise<void> {
    if (!this.activePlan) return;

    const now = new Date();
    const planStartDate = new Date(this.activePlan.startDate);

    for (const activity of this.activePlan.activities) {
      const activityStartDate = this.getActivityStartDate(activity, planStartDate);
      const activityDuration = activity.duration_hrs || 0;
      const activityEndDate = new Date(activityStartDate.getTime() + activityDuration * 60 * 60 * 1000);
      const notificationDate = new Date(activityEndDate.getTime() - this.NOTIFICATION_ADVANCE_MIN * 60 * 1000);

      if (notificationDate > now) {
        await this.scheduleNotificationForActivity(activity, notificationDate);
      }
    }
  }

  /**
   * Stop tracking the current plan
   */
  public stopTrackingPlan(): void {
    console.log('[PlanNotifications] Stopping plan tracking');
    
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }
    
    // Cancel all scheduled notifications
    this.notificationTimer.forEach(async (notificationId) => {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      } catch (error) {
        console.error('[PlanNotifications] Error canceling notification:', error);
      }
    });
    this.notificationTimer.clear();
    
    this.activePlan = null;
    this.notifiedActivities.clear();
  }

  /**
   * Check each activity and schedule notifications if needed
   */
  private checkAndNotify(): void {
    if (!this.activePlan) return;

    const now = new Date();
    const planStartDate = new Date(this.activePlan.startDate);

    this.activePlan.activities.forEach((activity, index) => {
      const activityStartDate = this.getActivityStartDate(activity, planStartDate);
      const activityDuration = activity.duration_hrs || 0;
      const activityEndDate = new Date(activityStartDate.getTime() + activityDuration * 60 * 60 * 1000);
      const notificationDate = new Date(activityEndDate.getTime() - this.NOTIFICATION_ADVANCE_MIN * 60 * 1000);

      if (
        now >= notificationDate &&
        now < activityEndDate &&
        !this.notifiedActivities.has(activity.id)
      ) {
        this.sendNotification(activity, index);
        this.notifiedActivities.add(activity.id);
      }
    });
  }

  /**
   * Send an immediate notification
   */
  private async sendNotification(activity: PlanActivityStep, index: number): Promise<void> {
    try {
      // Request permission first
      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) {
        console.warn('[PlanNotifications] No notification permission');
        return;
      }

      const nextActivity = this.activePlan?.activities[index + 1];
      const nextActivityName = nextActivity?.name || 'Next activity';
      const timeRemaining = this.NOTIFICATION_ADVANCE_MIN;

      console.log(`[PlanNotifications] Sending notification - Activity: ${activity.name}, Next: ${nextActivityName}`);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Get Ready!',
          body: `Your time at ${activity.name} is ending in ${timeRemaining} minutes.\nNext: ${nextActivityName}`,
          data: {
            activityId: activity.id,
            planId: this.activePlan?.id,
            type: 'plan-reminder',
            currentActivityIndex: index,
          },
          sound: true,
          priority: 'high',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 1, // Send immediately
        },
      });

      console.log('[PlanNotifications] Sent notification for activity:', activity.name, 'ID:', notificationId);
    } catch (error) {
      console.error('[PlanNotifications] Error sending notification:', error);
    }
  }

  /**
   * Schedule notification for a future activity (for background tracking)
   */
  private async scheduleNotificationForActivity(
    activity: PlanActivityStep,
    notificationDate: Date
  ): Promise<void> {
    try {
      if (this.notificationTimer.has(activity.id)) {
        const existingId = this.notificationTimer.get(activity.id)!;
        try {
          await Notifications.cancelScheduledNotificationAsync(existingId);
        } catch (error) {
          console.error('[PlanNotifications] Error canceling existing notification:', error);
        }
      }

      const now = new Date();
      console.log(`[PlanNotifications] Scheduling for ${activity.name}: Notify at ${notificationDate.toISOString()}, From now: ${((notificationDate.getTime() - now.getTime()) / 60000).toFixed(2)} min`);

      if (notificationDate <= now) {
        console.log(`[PlanNotifications] Activity ${activity.name} notification time is in the past, skipping schedule`);
        return;
      }

      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) {
        console.warn('[PlanNotifications] No notification permission for scheduled notification');
        return;
      }

      const nextActivity = this.activePlan?.activities.find((a) => this.timeStringToHour(a.time) > this.timeStringToHour(activity.time));
      const nextActivityName = nextActivity?.name || 'Next activity';

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Get Ready!',
          body: `Your time at ${activity.name} is ending in ${this.NOTIFICATION_ADVANCE_MIN} minutes.\nNext: ${nextActivityName}`,
          data: {
            activityId: activity.id,
            planId: this.activePlan?.id,
            type: 'plan-reminder',
          },
          sound: true,
          priority: 'high',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: notificationDate,
        },
      });

      console.log('[PlanNotifications] Scheduled notification for activity:', activity.name, 'at:', notificationDate, 'ID:', notificationId);
      this.notificationTimer.set(activity.id, notificationId as any);
    } catch (error) {
      console.error('[PlanNotifications] Error scheduling notification:', error);
    }
  }

  /**
   * Request notification permissions
   */
  private async requestNotificationPermission(): Promise<boolean> {
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === 'granted') return true;

      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('[PlanNotifications] Error requesting permission:', error);
      return false;
    }
  }

  /**
   * Convert time string (HH:MM) to hours since midnight
   */
  private getActivityStartDate(activity: PlanActivityStep, planStartDate: Date): Date {
    const [hStr, mStr] = activity.time.split(':');
    const hour = parseInt(hStr, 10) || 0;
    const minute = parseInt(mStr || '0', 10) || 0;

    const activityDate = new Date(planStartDate);
    activityDate.setHours(hour, minute, 0, 0);

    if (activityDate.getTime() < planStartDate.getTime() - 1000) {
      activityDate.setDate(activityDate.getDate() + 1);
    }

    return activityDate;
  }

  private timeStringToHour(timeStr: string): number {
    const [hStr, mStr] = timeStr.split(':');
    const hours = parseInt(hStr, 10);
    const minutes = parseInt(mStr || '0', 10);
    return hours + minutes / 60;
  }

  /**
   * Handle app state changes (foreground/background)
   */
  private handleAppStateChange = (nextAppState: string): void => {
    this.appState = nextAppState;
    console.log('[PlanNotifications] App state changed to:', nextAppState);

    if (nextAppState === 'background' && this.activePlan) {
      // When going to background, re-check and schedule notifications
      // This ensures we catch any upcoming notifications even if app was backgrounded
      this.checkAndNotify();
    }
  };

  /**
   * Get current tracking status
   */
  public getStatus(): { isTracking: boolean; planId?: string; nextActivity?: PlanActivityStep } {
    if (!this.activePlan) {
      return { isTracking: false };
    }

    const now = new Date();
    const planStartDate = new Date(this.activePlan.startDate);
    const elapsedMs = now.getTime() - planStartDate.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    let nextActivity: PlanActivityStep | undefined;
    for (const activity of this.activePlan.activities) {
      const startHour = this.timeStringToHour(activity.time);
      const endHour = startHour + (activity.duration_hrs || 0);
      
      if (elapsedHours < endHour) {
        nextActivity = activity;
        break;
      }
    }

    return {
      isTracking: true,
      planId: this.activePlan.id,
      nextActivity,
    };
  }
}

// ── Singleton instance ───────────────────────────────────────────────────────
let instance: PlanNotificationManager | null = null;

export function getPlanNotificationManager(): PlanNotificationManager {
  if (!instance) {
    instance = new PlanNotificationManager();
  }
  return instance;
}

// ── Configure notification handler for foreground ──────────────────────────
export async function askForNotificationPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    console.log('[PlanNotifications] Existing permission status:', current.status);

    if (current.status === 'granted') return true;
    if (current.status === 'denied') return false;

    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
      android: { allowAlert: true, allowBadge: true, allowSound: true },
    });

    console.log('[PlanNotifications] Requested permission status:', status);

    return status === 'granted';
  } catch (error) {
    console.error('[PlanNotifications] Error requesting permission on startup:', error);
    return false;
  }
}

export function configurePlanNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Handle notification interactions (user tapped notification)
  Notifications.addNotificationResponseReceivedListener((response) => {
    const content = (response.notification as any).request?.content ?? (response.notification as any).content;
    const data = content?.data;
    if (data?.type === 'plan-reminder') {
      console.log('[PlanNotifications] User tapped notification for activity:', data.activityId);
      // You can emit an event or call a callback here
      // For example: alert(`You tapped reminder for activity ${data.activityId}`);
    }
  });
}

// ── Export convenience functions ─────────────────────────────────────────
export function startTrackingPlan(plan: ActivePlan): void {
  getPlanNotificationManager().startTrackingPlan(plan);
}

export function stopTrackingPlan(): void {
  getPlanNotificationManager().stopTrackingPlan();
}

export function getTrackingStatus() {
  return getPlanNotificationManager().getStatus();
}
