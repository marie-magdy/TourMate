/**
 * planNotifications.ts
 * 
 * Real-time notification system for active plans.
 * Sends notifications 5 minutes before each activity in the itinerary ends.
 * Works on iOS, Android, and web via Expo Notifications.
 */

import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';

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
  private trackingInterval: NodeJS.Timeout | null = null;
  private notificationTimer: Map<string | number, NodeJS.Timeout> = new Map();
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
  public startTrackingPlan(plan: ActivePlan): void {
    console.log('[PlanNotifications] Starting to track plan:', plan.id);
    
    // Stop any existing tracking
    this.stopTrackingPlan();
    
    this.activePlan = plan;
    this.notifiedActivities.clear();
    
    // Start the main tracking loop
    this.trackingInterval = setInterval(
      () => this.checkAndNotify(),
      5000 // Check every 5 seconds for responsiveness
    );
    
    // Do an initial check
    this.checkAndNotify();
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
    
    // Clear all pending timers
    this.notificationTimer.forEach(timer => clearTimeout(timer));
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
    
    // Get the elapsed time from plan start
    const elapsedMs = now.getTime() - planStartDate.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    this.activePlan.activities.forEach((activity, index) => {
      const activityStartHour = this.timeStringToHour(activity.time);
      const activityDuration = activity.duration_hrs || 0;
      const activityEndHour = activityStartHour + activityDuration;

      // Calculate when to send notification (5 minutes before end)
      const notificationHour = activityEndHour - (this.NOTIFICATION_ADVANCE_MIN / 60);

      // Check if we should send notification now
      if (
        elapsedHours >= notificationHour &&
        elapsedHours < activityEndHour &&
        !this.notifiedActivities.has(activity.id)
      ) {
        this.sendNotification(activity, index);
        this.notifiedActivities.add(activity.id);
      }

      // Also schedule notifications for future activities (if app is backgrounded)
      if (elapsedHours < notificationHour) {
        this.scheduleNotificationForActivity(activity, activityEndHour);
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
          type: Notifications.SchedulableTriggerInputTypes.SECONDS,
          seconds: 1, // Send immediately
        },
      });

      console.log('[PlanNotifications] Sent notification for activity:', activity.name);
    } catch (error) {
      console.error('[PlanNotifications] Error sending notification:', error);
    }
  }

  /**
   * Schedule notification for a future activity (for background tracking)
   */
  private scheduleNotificationForActivity(
    activity: PlanActivityStep,
    activityEndHour: number
  ): void {
    // Clear any existing timer for this activity
    if (this.notificationTimer.has(activity.id)) {
      clearTimeout(this.notificationTimer.get(activity.id)!);
    }

    const now = new Date();
    const planStartDate = new Date(this.activePlan?.startDate || now);
    const elapsedMs = now.getTime() - planStartDate.getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);

    const notificationHour = activityEndHour - (this.NOTIFICATION_ADVANCE_MIN / 60);
    const hoursUntilNotification = notificationHour - elapsedHours;

    if (hoursUntilNotification > 0) {
      const msUntilNotification = hoursUntilNotification * 60 * 60 * 1000;

      const timer = setTimeout(() => {
        const activityIndex = this.activePlan?.activities.findIndex(a => a.id === activity.id) ?? -1;
        if (activityIndex >= 0) {
          this.sendNotification(activity, activityIndex);
          this.notifiedActivities.add(activity.id);
        }
      }, msUntilNotification);

      this.notificationTimer.set(activity.id, timer);
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
    const { data } = response.notification.content;
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
