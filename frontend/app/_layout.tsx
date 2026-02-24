import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      {/* Use exact route names as in your folder structure */}
      <Stack.Screen
        name="(auth)/login"
        options={{ title: 'Login' }}
      />
      <Stack.Screen
        name="(auth)/signup"
        options={{ title: 'Sign-up' }}
      />
      <Stack.Screen
        name="(auth)/confirmation"
        options={{ title: 'Confirmation' }}
      />
    </Stack>
  );
}
