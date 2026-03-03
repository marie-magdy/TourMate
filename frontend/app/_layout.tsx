
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Use exact route names as in your folder structure */}
      <Stack.Screen name="index" />
      <Stack.Screen name="splash" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(auth)/login" options={{ headerShown: true, title: "Login" }} />
      <Stack.Screen
        name="(auth)/signup"
        options={{ title: 'Sign-up' }}
      />     
      <Stack.Screen name="(auth)/confirmation" options={{ headerShown: true, title: "Confirmation" }} />
      <Stack.Screen name="(main)/home" />               
      <Stack.Screen name="(main)/attraction" />          
    </Stack>
  
  );
}