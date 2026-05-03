// app/(admin)/_layout.tsx
import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="dashboard" options={{ gestureEnabled: false }} />
      <Stack.Screen name="attractions" />
      <Stack.Screen name="add-attraction" />
    </Stack>
  );
}