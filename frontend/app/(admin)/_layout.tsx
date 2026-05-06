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

// import { Stack, useRouter } from 'expo-router';
// import { useEffect, useState } from 'react';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import { ActivityIndicator, View } from 'react-native';

// export default function AdminLayout() {
//   const router = useRouter();
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const checkAdmin = async () => {
//       try {
//         const userStr = await AsyncStorage.getItem('user');

//         if (!userStr) {
//           router.replace('/(auth)/login');
//           return;
//         }

//         const user = JSON.parse(userStr);

//         if (user.role !== 'admin') {
//           router.replace('/(main)/home');
//           return;
//         }

//         setLoading(false);
//       } catch (err) {
//         console.error('Admin guard error:', err);
//         router.replace('/(auth)/login');
//       }
//     };

//     checkAdmin();
//   }, []);

//   // ⛔ Prevent rendering until auth is verified
//   if (loading) {
//     return (
//       <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
//         <ActivityIndicator />
//       </View>
//     );
//   }

//   return (
//     <Stack screenOptions={{ headerShown: false, gestureEnabled: false }}>
//       <Stack.Screen name="dashboard" options={{ gestureEnabled: false }} />
//       <Stack.Screen name="attractions" />
//       <Stack.Screen name="add-attraction" />
//     </Stack>
//   );
// }

// import { Stack } from 'expo-router';

// export default function AdminLayout() {
//   return <Stack screenOptions={{ headerShown: false }} />;
// }