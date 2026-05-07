/**
 * planNotificationsBackground.ts
 * 
 * Stores active plan in AsyncStorage for reference and recovery.
 * Primary notifications are handled by planNotifications.ts foreground tracking.
 * 
 * Note: Full background task support requires expo-background-fetch and expo-task-manager.
 * This simplified version stores plan state for app re-initialization.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVE_PLAN_STORAGE_KEY = '@active_plan';

// ── Types ────────────────────────────────────────────────────────────────────
interface StoredPlan {
  id: string;
  userId: string;
  startDate: string; // ISO string
  activities: any[];
}

/**
 * No-op stub for backward compatibility.
 * Background task registration requires expo-background-fetch and expo-task-manager.
 * Call this during app init but it will safely do nothing if packages aren't available.
 */
export async function registerPlanNotificationsBackgroundTask(): Promise<void> {
  console.log('[BackgroundTask] Background task support requires expo-background-fetch and expo-task-manager.');
  console.log('[BackgroundTask] Foreground tracking in planNotifications.ts will handle active notifications.');
}

/**
 * Unregister the background task (stub for compatibility)
 */
export async function unregisterPlanNotificationsBackgroundTask(): Promise<void> {
  console.log('[BackgroundTask] Unregister stub called');
}

/**
 * Store active plan for app re-initialization
 * Call this when user starts viewing/tracking their plan
 */
export async function storeActivePlanForBackground(plan: StoredPlan): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_PLAN_STORAGE_KEY, JSON.stringify(plan));
    
    // Clear previous notified activities when starting new plan
    const notifiedKey = `@notified_activities_${plan.id}`;
    await AsyncStorage.removeItem(notifiedKey);
    
    console.log('[BackgroundTask] Stored active plan:', plan.id);
  } catch (error) {
    console.error('[BackgroundTask] Storage error:', error);
  }
}

/**
 * Clear active plan from storage
 * Call this when user finishes their plan
 */
export async function clearActivePlanFromBackground(planId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(ACTIVE_PLAN_STORAGE_KEY);
    
    // Clear notified activities
    const notifiedKey = `@notified_activities_${planId}`;
    await AsyncStorage.removeItem(notifiedKey);
    
    console.log('[BackgroundTask] Cleared active plan');
  } catch (error) {
    console.error('[BackgroundTask] Clear error:', error);
  }
}

/**
 * Retrieve stored plan for app re-initialization
 * Can be used to resume tracking if app was terminated
 */
export async function getStoredActivePlan(): Promise<StoredPlan | null> {
  try {
    const planJson = await AsyncStorage.getItem(ACTIVE_PLAN_STORAGE_KEY);
    return planJson ? JSON.parse(planJson) : null;
  } catch (error) {
    console.error('[BackgroundTask] Retrieve error:', error);
    return null;
  }
}

