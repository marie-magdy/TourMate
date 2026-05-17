import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View, Text, StyleSheet, Image, Dimensions, TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { PagerViewOnPageSelectedEvent } from 'react-native-pager-view';
import { Asset } from 'expo-asset';
import { Theme } from "../constants/theme"; // adjust path if needed

const { width } = Dimensions.get("window");

const IMAGES = [
  require('../assets/start1.png'),
  require('../assets/start2.png'),
  require('../assets/start3.png'),
  require('../assets/start4.png'),
];

const slides = [
  {
    key: "1",
    image: IMAGES[0],
    title: "Plan Your Perfect Egyptian Adventure with AI",
    subtitle: "Get personalized trip plans based on your interests, budget, and trip duration, all designed to create your ideal journey.",
  },
  {
    key: "2",
    image: IMAGES[1],
    title: "Instantly Learn About Every Landmark",
    subtitle: "Snap a photo of any landmark to get instant historical facts, stories, and directions powered by AI image recognition.",
  },
  {
    key: "3",
    image: IMAGES[2],
    title: "Chat with your personal AI tour guide",
    subtitle: "Get instant answers and personalized recommendations — your chatbot is available 24/7.",
  },
  {
    key: "4",
    image: IMAGES[3],
    title: "Eco-Smart Routes, Made for You",
    subtitle: "Choose greener routes and avoid traffic. Travel at the best time with less crowding and lower emissions.",
  },
];

async function preloadImages() {
  await Asset.loadAsync(IMAGES);
}

function NativeOnboarding() {
  const router = useRouter();
  const pagerRef = useRef<any>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const PagerView = useMemo(() => require("react-native-pager-view").default, []);

  const goNext = (page: number) => {
    if (page < slides.length - 1) {
      pagerRef.current?.setPage(page + 1);
    } else {
      router.replace("/login");
    }
  };

  return (
    <View style={styles.container}>
      <PagerView
        style={{ flex: 1 }}
        initialPage={0}
        ref={pagerRef}
        onPageSelected={(e: PagerViewOnPageSelectedEvent) => setCurrentPage(e.nativeEvent.position)}
      >
        {slides.map((slide, index) => (
          <View style={styles.page} key={slide.key}>
            <Image source={slide.image} style={styles.image} resizeMode="contain" />
            <View style={styles.dots}>
              {slides.map((_, i) => (
                <View key={i} style={[styles.dot, i === currentPage && styles.dotActive]} />
              ))}
            </View>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.subtitle}>{slide.subtitle}</Text>
            <TouchableOpacity style={styles.button} onPress={() => goNext(index)}>
              {index === slides.length - 1
                ? <Text style={styles.buttonText}>Start</Text>
                : <MaterialCommunityIcons name="arrow-right" size={28} color="#FFFFFF" />
              }
            </TouchableOpacity>
          </View>
        ))}
      </PagerView>
    </View>
  );
}

export default function Onboarding() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    preloadImages().then(() => setReady(true));
  }, []);

  if (!ready) return null;

  return <NativeOnboarding />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
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
    color: Theme.colors.hero,
    textAlign: "center",
    marginBottom: 15,
  },

  subtitle: {
    fontSize: 14,
    color: Theme.colors.muted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
    maxWidth: 520,
  },

  button: {
    minWidth: 60,
    height: 60,
    paddingHorizontal: 24,
    backgroundColor: Theme.colors.primary,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },

buttonText: {
  fontSize: 18,
  color: Theme.colors.white,
  fontWeight: '700',
  letterSpacing: 0.5,
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
    backgroundColor: Theme.colors.border,
  },

  dotActive: {
    width: 24,
    backgroundColor: Theme.colors.primary,
  },
});