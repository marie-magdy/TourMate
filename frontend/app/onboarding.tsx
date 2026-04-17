import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const slides = [
  {
    key: "1",
    image: require("../assets/start1.png"),
    title: "Plan Your Perfect Egyptian Adventure with AI",
    subtitle:
      "Get personalized trip plans based on your interests, budget, and trip duration, all designed to create your ideal journey.",
  },
  {
    key: "2",
    image: require("../assets/start2.png"),
    title: "Instantly Learn About Every Landmark",
    subtitle:
      "Snap a photo of any landmark to get instant historical facts, stories, and directions powered by AI image recognition.",
  },
];

function WebOnboarding() {
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
      <View style={styles.webCard}>
        <Image source={slide.image} style={styles.image} resizeMode="contain" />
        <View style={styles.dots}>
          {slides.map((_, index) => (
            <View key={index} style={[styles.dot, index === page && styles.dotActive]} />
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

function NativeOnboarding() {
  const router = useRouter();
  const pagerRef = useRef<any>(null);
  const PagerView = useMemo(() => require("react-native-pager-view").default, []);

  const goNext = (page: number) => {
    if (page === 0) {
      pagerRef.current?.setPage(1);
    } else {
      router.replace("/login");
    }
  };

  return (
    <View style={styles.container}>
      <PagerView style={{ flex: 1 }} initialPage={0} ref={pagerRef}>
        <View style={styles.page} key="1">
          <Image source={slides[0].image} style={styles.image} resizeMode="contain" />
          <Text style={styles.title}>{slides[0].title}</Text>
          <Text style={styles.subtitle}>{slides[0].subtitle}</Text>
          <TouchableOpacity style={styles.button} onPress={() => goNext(0)}>
            <MaterialCommunityIcons name="arrow-right" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.page} key="2">
          <Image source={slides[1].image} style={styles.image} resizeMode="contain" />
          <Text style={styles.title}>{slides[1].title}</Text>
          <Text style={styles.subtitle}>{slides[1].subtitle}</Text>
          <TouchableOpacity style={styles.button} onPress={() => goNext(1)}>
            <MaterialCommunityIcons name="arrow-right" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </PagerView>
    </View>
  );
}

export default function Onboarding() {
  return Platform.OS === "web" ? <WebOnboarding /> : <NativeOnboarding />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F2",
  },
  webCard: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    margin: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    shadowColor: "#000000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  page: {
    width,
    alignItems: "center",
    padding: 25,
    justifyContent: "center",
  },
  image: {
    width: width * 0.95,
    height: width * 0.95,
    maxWidth: 360,
    maxHeight: 360,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E1E1E",
    textAlign: "center",
    marginBottom: 15,
  },
  subtitle: {
    fontSize: 14,
    color: "#7A7A7A",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
    maxWidth: 520,
  },
  button: {
    minWidth: 60,
    height: 60,
    paddingHorizontal: 24,
    backgroundColor: "#D49A2A",
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 24,
    color: "#FFFFFF",
    fontWeight: "bold",
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
    width: 24,
    backgroundColor: "#D49A2A",
  },
});
