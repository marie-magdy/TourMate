/**
 * planNotificationTypes.ts
 * 
 * Centralized type definitions for the plan notification system.
 * Import from this file for consistency across the app.
 */

/**
 * A single activity/step in a plan itinerary
 */
export interface PlanActivityStep {
  // Required fields
  id: string | number;
  name: string;
  type: ActivityType;
  time: string; // HH:MM format
  duration_hrs: number;

  // Optional fields
  departure_time?: string; // HH:MM when leaving previous location
  travel_duration_min?: number; // Minutes to travel there
  latitude?: number;
  longitude?: number;
  
  // From recommendation engine
  cost_egp?: number;
  distance_km?: number;
  address?: string;
  description?: string;
  rating?: number;
  categories?: string[];
  image_url?: string;
  price_from?: number;
  transport?: TransportInfo;
  transport_cost?: number;
  osm_url?: string;
  directions_url?: string;
  options?: any[];
}

/**
 * Activity type - what kind of stop is this?
 */
export type ActivityType = 
  | 'Attraction'
  | 'Breakfast'
  | 'Lunch'
  | 'Dinner'
  | 'Snack'
  | 'Coffee'
  | 'Rest'
  | 'Transport'
  | string;

/**
 * Transport information for getting to activity
 */
export interface TransportInfo {
  type?: string; // 'walking', 'taxi', 'metro', etc.
  duration_min?: number; // Travel duration in minutes
  distance_km?: number; // Distance in km
  cost_egp?: number; // Cost in EGP
  directions_url?: string; // Google Maps or similar
}

/**
 * A complete plan/itinerary for a day or trip
 */
export interface ActivePlan {
  id: string;
  userId: string;
  startDate: Date; // When the tracking starts
  activities: PlanActivityStep[];
  
  // Optional metadata
  city?: string;
  endDate?: Date;
  budget?: number;
  interests?: string[];
}

/**
 * Stored plan format for AsyncStorage
 */
export interface StoredPlan {
  id: string;
  userId: string;
  startDate: string; // ISO string
  activities: PlanActivityStep[];
}

/**
 * Status of the tracking system
 */
export interface TrackingStatus {
  isTracking: boolean;
  planId?: string;
  currentActivity?: PlanActivityStep;
  nextActivity?: PlanActivityStep;
  currentActivityIndex?: number;
  totalActivities?: number;
  percentComplete?: number; // 0-100
  timeRemainingMs?: number; // Milliseconds left in current activity
}

/**
 * Options for the usePlanTracking hook
 */
export interface UsePlanTrackingOptions {
  autoStart?: boolean;
  onActivityChange?: (activity: PlanActivityStep | undefined) => void;
  onPlanComplete?: () => void;
  pollingIntervalMs?: number; // How often to check status (default 1000)
}

/**
 * Hook return value
 */
export interface UsePlanTrackingReturn {
  isTracking: boolean;
  currentActivity: PlanActivityStep | undefined;
  planId: string | undefined;
  startTracking: (plan: ActivePlan) => void;
  stopTracking: () => void;
}

/**
 * Notification content
 */
export interface PlanNotification {
  id: string; // Notification ID
  title: string;
  body: string;
  data: {
    activityId: string | number;
    planId: string;
    type: 'plan-reminder' | 'plan-reminder-background';
    currentActivityIndex: number;
  };
  timestamp: Date;
  sent: boolean;
}

/**
 * Configuration options
 */
export interface PlanNotificationConfig {
  advanceMinutes?: number; // Default: 5 minutes before activity ends
  backgroundCheckInterval?: number; // Default: 30 seconds
  soundEnabled?: boolean; // Default: true
  vibrationEnabled?: boolean; // Default: true
}

/**
 * Backend plan response format (from /api/plans/:user_id)
 */
export interface SavedPlanResponse {
  id: string | number;
  city: string;
  start_date: string;
  end_date: string;
  budget: string;
  itinerary: PlanActivityStep[]; // Array of activities
  created_at: string;
}

/**
 * Recommendation engine plan format (from /api/recommendations)
 */
export interface RecommendationPlanResponse {
  itinerary: PlanActivityStep[];
  total_cost_egp: number;
  total_time_hours: number;
  daily_plan?: boolean;
  city: string;
}

/**
 * Enum for common activity types
 */
export const ACTIVITY_TYPES = {
  ATTRACTION: 'Attraction',
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
  COFFEE: 'Coffee',
  REST: 'Rest',
  TRANSPORT: 'Transport',
} as const;

/**
 * Helper function to get emoji for activity type
 */
export function getActivityEmoji(type: ActivityType): string {
  switch (type.toLowerCase()) {
    case 'attraction':
      return '🎭';
    case 'breakfast':
      return '🍳';
    case 'lunch':
      return '🍽️';
    case 'dinner':
      return '🍽️';
    case 'snack':
      return '🍿';
    case 'coffee':
      return '☕';
    case 'rest':
      return '🪑';
    case 'transport':
      return '🚕';
    default:
      return '📍';
  }
}

/**
 * Helper function to convert time string to hours
 */
export function timeStringToHours(timeStr: string): number {
  const [hStr, mStr] = timeStr.split(':');
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr || '0', 10);
  return hours + minutes / 60;
}

/**
 * Helper function to convert hours to time string
 */
export function hoursToTimeString(hours: number): string {
  const h = Math.floor(hours) % 24;
  const m = Math.round((hours - Math.floor(hours)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Helper function to calculate duration between two time strings
 */
export function getTimeDifference(start: string, end: string): number {
  return timeStringToHours(end) - timeStringToHours(start);
}

/**
 * Helper function to add minutes to a time string
 */
export function addMinutesToTime(timeStr: string, minutes: number): string {
  const hours = timeStringToHours(timeStr);
  const newHours = hours + minutes / 60;
  return hoursToTimeString(newHours);
}
