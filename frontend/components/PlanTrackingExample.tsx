/**
 * PlanTrackingExample.tsx
 * 
 * Example component showing how to integrate plan notifications
 * into your itinerary/plan viewing screen.
 * 
 * This component demonstrates:
 * - Starting plan tracking when user views their active plan
 * - Showing current activity and time remaining
 * - Stopping tracking when plan is complete or user leaves
 * - Background notification support
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { usePlanTracking } from '../hooks/usePlanTracking';
import {
  registerPlanNotificationsBackgroundTask,
  storeActivePlanForBackground,
  clearActivePlanFromBackground,
} from '../utils/planNotificationsBackground';
import { ActivePlan, PlanActivityStep } from '../utils/planNotifications';

interface Props {
  plan: ActivePlan;
  onPlanComplete?: () => void;
}

export const PlanTrackingExample: React.FC<Props> = ({ plan, onPlanComplete }) => {
  const { isTracking, currentActivity, startTracking, stopTracking } = usePlanTracking({
    onActivityChange: (activity) => {
      console.log('[PlanTrackingExample] Activity changed:', activity?.name);
    },
  });

  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [allActivities, setAllActivities] = useState<PlanActivityStep[]>([]);
  const [currentActivityIndex, setCurrentActivityIndex] = useState(-1);

  useEffect(() => {
    // Initialize background task on component mount
    const initBackground = async () => {
      try {
        await registerPlanNotificationsBackgroundTask();
      } catch (error) {
        console.error('Error registering background task:', error);
      }
    };
    initBackground();
  }, []);

  // Start tracking when component mounts
  useEffect(() => {
    if (plan && !isTracking) {
      startTracking(plan);
      storeActivePlanForBackground({
        id: plan.id,
        userId: plan.userId,
        startDate: plan.startDate.toISOString(),
        activities: plan.activities,
      });
    }

    return () => {
      // Note: Don't stop tracking on unmount - user might navigate away temporarily
      // Instead, stop tracking only when plan is explicitly completed
    };
  }, [plan, isTracking, startTracking]);

  // Update time remaining
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentActivity && isTracking) {
        const now = new Date();
        const planStart = new Date(plan.startDate);
        const elapsedMs = now.getTime() - planStart.getTime();
        const elapsedHours = elapsedMs / (1000 * 60 * 60);

        const actStartHour = timeStringToHour(currentActivity.time);
        const actEndHour = actStartHour + (currentActivity.duration_hrs || 0);
        const remainingHours = Math.max(0, actEndHour - elapsedHours);
        const remainingMinutes = Math.round(remainingHours * 60);

        if (remainingMinutes <= 0) {
          setTimeRemaining('Time to leave!');
        } else if (remainingMinutes === 1) {
          setTimeRemaining('1 minute left');
        } else {
          setTimeRemaining(`${remainingMinutes} min left`);
        }

        // Update current activity index
        const index = plan.activities.findIndex(a => a.id === currentActivity.id);
        setCurrentActivityIndex(index);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentActivity, isTracking, plan]);

  const handleStopTracking = async () => {
    Alert.alert('Stop Tracking?', 'Are you sure you want to stop tracking this plan?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Stop',
        onPress: async () => {
          stopTracking();
          await clearActivePlanFromBackground(plan.id);
          onPlanComplete?.();
        },
      },
    ]);
  };

  if (!isTracking || !currentActivity) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading plan...</Text>
      </View>
    );
  }

  const nextActivity = currentActivityIndex + 1 < plan.activities.length
    ? plan.activities[currentActivityIndex + 1]
    : null;

  return (
    <View style={styles.container}>
      {/* Current Activity Card */}
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.currentActivityLabel}>Currently at</Text>
          <TouchableOpacity onPress={handleStopTracking}>
            <MaterialCommunityIcons name="close" size={24} color="#EF4444" />
          </TouchableOpacity>
        </View>

        <Text style={styles.activityName} numberOfLines={2}>
          {currentActivity.name}
        </Text>

        <Text style={styles.activityType}>{currentActivity.type}</Text>

        {/* Time remaining - Warning if < 5 minutes */}
        <View
          style={[
            styles.timeBox,
            parseInt(timeRemaining) < 5 && styles.timeBoxWarning,
          ]}
        >
          <MaterialCommunityIcons
            name="clock-outline"
            size={20}
            color={parseInt(timeRemaining) < 5 ? '#EF4444' : '#3B82F6'}
          />
          <Text
            style={[
              styles.timeText,
              parseInt(timeRemaining) < 5 && styles.timeTextWarning,
            ]}
          >
            {timeRemaining}
          </Text>
        </View>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressLabel}>
            <Text style={styles.progressText}>
              Activity {currentActivityIndex + 1} of {plan.activities.length}
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${
                    ((currentActivityIndex + 1) / plan.activities.length) * 100
                  }%`,
                },
              ]}
            />
          </View>
        </View>
      </View>

      {/* Next Activity Preview */}
      {nextActivity && (
        <View style={styles.nextActivityCard}>
          <Text style={styles.nextActivityLabel}>Next Stop</Text>
          <Text style={styles.nextActivityName}>{nextActivity.name}</Text>
          <Text style={styles.nextActivityTime}>
            In {(nextActivity.duration_hrs || 0) * 60} minutes
          </Text>
        </View>
      )}

      {/* Activity List */}
      <View style={styles.activitiesSection}>
        <Text style={styles.sectionTitle}>Itinerary</Text>
        {plan.activities.map((activity, index) => (
          <View
            key={activity.id}
            style={[
              styles.activityListItem,
              index === currentActivityIndex && styles.activeActivityItem,
            ]}
          >
            <View
              style={[
                styles.timelineDot,
                index === currentActivityIndex && styles.timelineDotActive,
              ]}
            />
            <View style={styles.activityListContent}>
              <Text
                style={[
                  styles.activityListName,
                  index === currentActivityIndex && styles.activityListNameActive,
                ]}
              >
                {activity.name}
              </Text>
              <Text style={styles.activityListTime}>
                {activity.time} • {Math.round(activity.duration_hrs * 60)} min
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

// ── Helper Functions ─────────────────────────────────────────────────────────

function timeStringToHour(timeStr: string): number {
  const [hStr, mStr] = timeStr.split(':');
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr || '0', 10);
  return hours + minutes / 60;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  currentActivityLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activityName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  activityType: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  timeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  timeBoxWarning: {
    backgroundColor: '#FEF2F2',
  },
  timeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
    marginLeft: 8,
  },
  timeTextWarning: {
    color: '#EF4444',
  },
  progressContainer: {
    gap: 8,
  },
  progressLabel: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  nextActivityCard: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  nextActivityLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  nextActivityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  nextActivityTime: {
    fontSize: 13,
    color: '#6B7280',
  },
  activitiesSection: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  activityListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomColor: '#E5E7EB',
    borderBottomWidth: 1,
  },
  activeActivityItem: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    marginHorizontal: -12,
    borderRadius: 8,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    marginRight: 12,
  },
  timelineDotActive: {
    backgroundColor: '#3B82F6',
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  activityListContent: {
    flex: 1,
  },
  activityListName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activityListNameActive: {
    color: '#1F2937',
    fontWeight: '600',
  },
  activityListTime: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
