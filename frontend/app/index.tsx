import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApp } from "../constants/AppContext";

export default function SplashScreen() {
  const router = useRouter();
  const { setUser } = useApp();

  useEffect(() => {
    const timer = setTimeout(() => {
      checkSession();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const checkSession = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const raw   = await AsyncStorage.getItem("user");

      if (token && raw) {
        // Restore session — skip onboarding and login
        const user = JSON.parse(raw);
        await setUser(user);
        if (user.role === "admin") {
          router.replace("/(admin)/dashboard" as any);
        } else {
          router.replace("/(main)/home" as any);
        }
      } else {
        // No session — go through normal flow
        router.replace("/onboarding");
      }
    } catch {
      router.replace("/onboarding");
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/logo.png")}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.title}>Tour Mate</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8D8B8",
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 220,
    height: 220,
    marginBottom: 30,
  },
  title: {
    fontSize: 42,
    fontWeight: "700",
    color: "#3E2A1F",
    letterSpacing: 1,
  },
});