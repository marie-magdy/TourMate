import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import PagerView from "react-native-pager-view";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");

export default function Onboarding() {
  const pagerRef = useRef<PagerView>(null);
  const router = useRouter();

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
        
        {/* Page 1 */}
        <View style={styles.page} key="1">
          <Image
            source={require("../assets/start1.png")}
            style={styles.image}
            resizeMode="contain"
          />

          <Text style={styles.title}>
            Plan Your Perfect Egyptian Adventure with AI
          </Text>

          <Text style={styles.subtitle}>
            Get personalized trip plans based on your interests, budget,
            and trip duration, all designed to create your ideal journey.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => goNext(0)}
          >
            <Text style={styles.buttonText}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Page 2 */}
        <View style={styles.page} key="2">
          <Image
            source={require("../assets/start2.png")}
            style={styles.image}
            resizeMode="contain"
          />

          <Text style={styles.title}>
            Instantly Learn About Every Landmark
          </Text>

          <Text style={styles.subtitle}>
            Snap a photo of any landmark to get instant historical facts,
            stories, and directions powered by AI image recognition.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={() => goNext(1)}
          >
            <Text style={styles.buttonText}>→</Text>
          </TouchableOpacity>
        </View>

      </PagerView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F2",
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
  },
  button: {
    width: 60,
    height: 60,
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
});