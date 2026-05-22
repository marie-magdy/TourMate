// app/_layout.tsx
import { useEffect } from "react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppState, type AppStateStatus } from "react-native";
import { AppProvider } from "../constants/AppContext";
import { askForNotificationPermission, configurePlanNotifications } from "../utils/planNotifications";
import { registerPlanNotificationsBackgroundTask } from "../utils/planNotificationsBackground";

export default function RootLayout() {
  useEffect(() => {
    configurePlanNotifications();

    async function initNotifications() {
      const granted = await askForNotificationPermission();
      console.log('[PlanNotifications] Startup permission granted:', granted);
    }

    function handleAppStateChange(nextAppState: AppStateStatus) {
      if (nextAppState === 'active') {
        askForNotificationPermission().catch((err) => console.warn('Notification permission request failed:', err));
      }
    }

    initNotifications().catch((err) => console.warn('Notification permission request failed:', err));
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    registerPlanNotificationsBackgroundTask().catch((err) => console.warn('Plan notification background task failed:', err));

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        {/* *<Stack.Screen name="splash" /> */}
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/signup" options={{ title: 'Sign-up' }} />
        <Stack.Screen name="(auth)/confirmation" options={{ headerShown: true, title: "Confirmation" }} />
        <Stack.Screen name="(admin)" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(main)/home" />
        <Stack.Screen name="(main)/attraction" />
        <Stack.Screen name="(main)/map" />
        <Stack.Screen name="(main)/settings" />
        <Stack.Screen name="(main)/plan" />
        <Stack.Screen name="(main)/pick-spots" />
        <Stack.Screen name="(main)/itinerary" />
        <Stack.Screen name="(main)/city-intro" />
        <Stack.Screen name="(main)/tourmate-ai" />
        <Stack.Screen name="(main)/favorites" />
        <Stack.Screen name="(main)/rewards" />
        <Stack.Screen name="(main)/saved-plans" />
        <Stack.Screen name="(main)/privacy" options={{ headerShown: false }} />
        <Stack.Screen name="(main)/terms" options={{ headerShown: false }} />
        <Stack.Screen name="(main)/about" options={{ headerShown: false }} />
      </Stack>
    </AppProvider>
    </SafeAreaProvider>
  );
}