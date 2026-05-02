import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

const slides = [
  {
    image: require("../assets/start1.png"),
    title: "Plan Your Perfect Egyptian Adventure with AI",
    subtitle:
      "Get personalized trip plans based on your interests, budget, and trip duration, all designed to create your ideal journey.",
  },
  {
    image: require("../assets/start2.png"),
    title: "Instantly Learn About Every Landmark",
    subtitle:
      "Snap a photo of any landmark to get instant historical facts, stories, and directions powered by AI image recognition.",
  },
];

export default function OnboardingWeb() {
  const [page, setPage] = useState(0);
  const router = useRouter();
  const slide = slides[page];

  const goNext = () => {
    if (page < slides.length - 1) {
      setPage((current) => current + 1);
      return;
    }
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image source={slide.image} style={styles.image} resizeMode="contain" />

        <View style={styles.dots}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === page && styles.dotActive]}
            />
          ))}
        </View>

        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>

        <TouchableOpacity style={styles.button} onPress={goNext}>
          <Text style={styles.buttonText}>{page === slides.length - 1 ? "Start" : "Next"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F2",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  image: {
    width: Math.min(width * 0.7, 340),
    height: Math.min(width * 0.7, 340),
    marginBottom: 18,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 18,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#D9D9D9",
  },
  dotActive: {
    backgroundColor: "#D49A2A",
    width: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1E1E1E",
    textAlign: "center",
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 15,
    color: "#7A7A7A",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 28,
  },
  button: {
    minWidth: 140,
    paddingHorizontal: 24,
    height: 56,
    backgroundColor: "#D49A2A",
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
