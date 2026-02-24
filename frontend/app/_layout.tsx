
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="login" options={{ headerShown: true, title: "Login" }} />
      <Stack.Screen name="register" options={{ headerShown: true, title: "Register" }} />
    </Stack>
  );
}