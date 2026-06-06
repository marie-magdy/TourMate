import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Attraction } from '../constants/types';
import { useApp } from '../constants/AppContext';

const CATEGORY_COLORS: Record<string, string> = {
  historical: '#8B4513',
  beaches:    '#0077B6',
  restaurants:'#E63946',
  shopping:   '#9B2335',
  nature:     '#2D6A4F',
  diving:     '#023E8A',
  culture:    '#6D3B8E',
  nightlife:  '#1A1A2E',
  adventure:  '#D62828',
};

const parseCategories = (cats: any): string[] => {
  if (!cats) return [];
  if (Array.isArray(cats)) return cats.map((c: string) => c.toLowerCase());
  if (typeof cats === 'string') return cats.replace(/[{}]/g, '').split(',').map(c => c.trim().toLowerCase()).filter(Boolean);
  return [];
};

const NearestCard: React.FC<{ item: Attraction; onPress?: (a: Attraction) => void }> = ({ item, onPress }) => {
  const { convertPrice } = useApp();
  const firstCategory = parseCategories(item.categories)[0] ?? '';
  const catColor = CATEGORY_COLORS[firstCategory] ?? '#C4873A';
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress?.(item)} activeOpacity={0.88}>
      <Image source={{ uri: item.primary_image }} style={styles.image} />
      <View style={styles.info}>
        <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.city}>{item.city}</Text>
        <View style={styles.footer}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="star" size={12} color="#F0A500" />
            <Text style={styles.rating}>{Number(item.rating).toFixed(1)}</Text>
          </View>
          <Text style={styles.price}>{convertPrice(item.price_from)}</Text>
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color="#CCC" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F3F3F3' },
  image: { width: 78, height: 64, borderRadius: 8, backgroundColor: '#EEE', marginRight: 12 },
  info: { flex: 1 },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 6 },
  name: { fontWeight: '700' },
  city: { color: '#666', marginTop: 4 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  rating: { color: '#888', marginLeft: 4, fontSize: 12 },
  price: { color: '#333', fontWeight: '700' },
});

export default NearestCard;
