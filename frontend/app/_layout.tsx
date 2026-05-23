// app/_layout.tsx
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "../constants/AppContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        {/* *<Stack.Screen name="splash" /> */}
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false, gestureEnabled: false }} />
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