import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

type TabItem = {
  name: string;
  label: string;
  iconDefault: any;
  iconActive: any;
  route: string;
};

const TABS: TabItem[] = [
  { name: 'Home', label: 'Home', iconDefault: 'home-outline', iconActive: 'home', route: '/(main)/home' },
  { name: 'Plan', label: 'Plan', iconDefault: 'calendar-plus-outline', iconActive: 'calendar-plus', route: '/(main)/plan' },
  { name: 'Tour Mate', label: 'AI', iconDefault: 'robot-outline', iconActive: 'robot', route: '/(main)/tourmate-ai' },
  { name: 'Favorites', label: 'Likes', iconDefault: 'heart-outline', iconActive: 'heart', route: '/(main)/favorites' },
  { name: 'My Plans', label: 'Plans', iconDefault: 'bookmark-multiple-outline', iconActive: 'bookmark-multiple', route: '/(main)/saved-plans' },
  { name: 'View Map', label: 'Map', iconDefault: 'map-marker-outline', iconActive: 'map-marker', route: '/(main)/map' },
];

export default function BottomTab({ active }: { active: string }) {
  const router = useRouter();

  return (
    <View style={styles.bottomTabWrap}>
      <View style={styles.bottomTab}>
        {TABS.map(tab => {
          const isActive = tab.name === active;

          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => {
                if (!isActive) router.push(tab.route as any);
              }}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons
                name={isActive ? tab.iconActive : tab.iconDefault}
                size={22}
                color={isActive ? '#fff' : 'rgba(255,255,255,0.45)'}
              />

              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Bottom Tab — floating pill ─────────────────────────────────────
  bottomTabWrap: {
    position: 'absolute', bottom: 20, left: 16, right: 16,
    alignItems: 'center',
  },
  bottomTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A0A00',
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 6,
    shadowColor: '#1A0A00',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 16,
    width: '100%',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 20,
    gap: 3,
  },
  tabItemActive: {
    backgroundColor: '#C4873A',
  },
  tabLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#FFF',
    fontWeight: '800',
  },

});