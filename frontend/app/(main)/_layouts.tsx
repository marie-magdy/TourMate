import { Slot, usePathname } from "expo-router";
import { View } from "react-native";
import BottomTab from '../../components/BottomTab';

export default function MainLayout() {
  const pathname = usePathname();

  // map route → active tab name
  const getActiveTab = () => {
    if (pathname.includes("home")) return "Home";
    if (pathname.includes("plan")) return "Plan";
    if (pathname.includes("tourmate-ai")) return "Tour Mate";
    if (pathname.includes("favorites")) return "Favorites";
    if (pathname.includes("saved-plans")) return "My Plans";
    // if (pathname.includes("map")) return "View Map";
    return "Home";
  };

  return (
    <View style={{ flex: 1 }}>
      {/* ALL screens render here */}
      <Slot />

      {/* YOUR CUSTOM TAB BAR (global) */}
      <BottomTab active={getActiveTab()} />
    </View>
  );
}