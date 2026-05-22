/**
 * testNotifications.ts
 * 
 * Utility for testing the notification system.
 * Use this to create a test plan and verify notifications are working.
 */

import { ActivePlan, PlanActivityStep, startTrackingPlan } from './planNotifications';

/**
 * Create a test plan for notification testing
 * Activities are scheduled for the current time to verify notifications
 */
export function createTestPlan(): ActivePlan {
  const now = new Date();
  
  // Create activities that will trigger notifications in the near future
  const activities: PlanActivityStep[] = [
    {
      id: 'test-activity-1',
      name: '🏛️ Museum Visit',
      type: 'Attraction',
      time: formatTime(now), // Start now
      duration_hrs: 0.1, // 6 minutes duration
      latitude: 30.0454,
      longitude: 31.2357,
    },
    {
      id: 'test-activity-2',
      name: '🍽️ Lunch Break',
      type: 'Lunch',
      time: formatTime(addMinutes(now, 10)), // 10 minutes from now
      duration_hrs: 0.5, // 30 minutes
      latitude: 30.0454,
      longitude: 31.2357,
    },
    {
      id: 'test-activity-3',
      name: '🏖️ Beach Time',
      type: 'Attraction',
      time: formatTime(addMinutes(now, 25)), // 25 minutes from now
      duration_hrs: 1, // 1 hour
      latitude: 30.0454,
      longitude: 31.2357,
    },
  ];

  const testPlan: ActivePlan = {
    id: 'test-plan-' + Date.now(),
    userId: 'test-user',
    startDate: now,
    activities,
  };

  console.log('[TestNotifications] Created test plan:', testPlan);
  console.log('[TestNotifications] First activity ends in ~6 minutes - notification should trigger at ~1 minute');
  console.log('[TestNotifications] Second activity ends in ~40 minutes - notification should trigger at ~35 minutes');

  return testPlan;
}

/**
 * Start the test plan with notifications
 */
export function startTestPlan(): void {
  const testPlan = createTestPlan();
  console.log('[TestNotifications] Starting test plan tracking...');
  console.log('[TestNotifications] Check the browser console or device logs to see notification debug messages');
  startTrackingPlan(testPlan);
}

/**
 * Helper: Format Date to HH:MM string
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Helper: Add minutes to a date
 */
function addMinutes(date: Date, minutes: number): Date {
  const result = new Date(date);
  result.setMinutes(result.getMinutes() + minutes);
  return result;
}
