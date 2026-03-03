import React, { useEffect } from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      //router.replace("/onboarding");
      router.replace("/onboarding");
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

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