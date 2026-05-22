/**
 * usePlanTracking.ts
 * 
 * React hook for tracking an active plan and sending notifications.
 * Use this hook in your plan/itinerary screens to enable real-time notifications.
 */

import { useEffect, useRef, useState } from 'react';
import {
  getPlanNotificationManager,
  configurePlanNotifications,
  ActivePlan,
  PlanActivityStep,
} from '../utils/planNotifications';

export interface UsePlanTrackingOptions {
  autoStart?: boolean;
  onActivityChange?: (activity: PlanActivityStep | undefined) => void;
}

export function usePlanTracking(options: UsePlanTrackingOptions = {}) {
  const { autoStart = false, onActivityChange } = options;
  const [isTracking, setIsTracking] = useState(false);
  const [currentActivity, setCurrentActivity] = useState<PlanActivityStep | undefined>(undefined);
  const [planId, setPlanId] = useState<string | undefined>(undefined);
  const statusCheckInterval = useRef<number | null>(null);

  // Initialize notification system on mount
  useEffect(() => {
    configurePlanNotifications();
  }, []);

  // Check tracking status periodically
  useEffect(() => {
    const checkStatus = () => {
      const manager = getPlanNotificationManager();
      const status = manager.getStatus();
      
      setIsTracking(status.isTracking);
      setPlanId(status.planId);
      
      if (status.nextActivity !== currentActivity) {
        setCurrentActivity(status.nextActivity);
        onActivityChange?.(status.nextActivity);
      }
    };

    statusCheckInterval.current = setInterval(checkStatus, 1000); // Check every second

    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, [currentActivity, onActivityChange]);

  const startTracking = (plan: ActivePlan) => {
    console.log('[usePlanTracking] Starting tracking for plan:', plan.id);
    getPlanNotificationManager().startTrackingPlan(plan);
    setIsTracking(true);
  };

  const stopTracking = () => {
    console.log('[usePlanTracking] Stopping tracking');
    getPlanNotificationManager().stopTrackingPlan();
    setIsTracking(false);
    setCurrentActivity(undefined);
    setPlanId(undefined);
  };

  return {
    isTracking,
    currentActivity,
    planId,
    startTracking,
    stopTracking,
  };
}
