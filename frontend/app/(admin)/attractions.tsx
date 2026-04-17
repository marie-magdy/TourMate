// app/(admin)/attractions.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, SafeAreaView, StatusBar, Alert,
  TextInput, Modal, ScrollView, Switch, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;

interface Attraction {
  id: number;
  name: string;
  city: string;          // ← still fine, comes from ci.name AS city
  city_id?: number;      // ← add this
  categories?: string[]; // ← change from category: string
  category?: string;     // ← keep as optional fallback
  description: string;
  primary_image: string; // ← was image_url
  rating: number;
  price_from: number;
  opening_hours: string;
  is_popular: boolean;
  latitude: number;
  longitude: number;
}

const CITIES = ['Alexandria', 'Cairo', 'Hurghada', 'Luxor', 'Aswan', 'Sharm El Sheikh'];
const CATEGORIES = ['historical', 'beaches', 'restaurants', 'shopping', 'nature', 'diving', 'culture', 'nightlife', 'adventure'];

const convertDriveUrl = (url: string): string => {
  if (!url) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  return url.trim();
};

// ── Edit Modal ────────────────────────────────────────────────────────
const EditModal: React.FC<{
  visible: boolean;
  attraction: Attraction | null;
  onClose: () => void;
  onSave: (data: Partial<Attraction> & { images: string[] }) => void;
}> = ({ visible, attraction, onClose, onSave }) => {
  const [name, setName] = useState('');
  const [city, setCity] = useState('Alexandria');
  const [category, setCategory] = useState('historical');
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState('4.5');
  const [price, setPrice] = useState('0');
  const [hours, setHours] = useState('');
  const [isPopular, setIsPopular] = useState(false);
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');

  useEffect(() => {
    if (attraction) {
      setName(attraction.name);
      setCity(attraction.city);
      setCategory(attraction.category);
      setDescription(attraction.description ?? '');
      setRating(String(attraction.rating));
      setPrice(String(attraction.price_from));
      setHours(attraction.opening_hours ?? '');
      setIsPopular(attraction.is_popular);
      setLat(String(attraction.latitude ?? ''));
      setLon(String(attraction.longitude ?? ''));
      // Load existing images
      fetchImages(attraction.id);
    } else {
      // Reset for new attraction
      setName(''); setCity('Alexandria'); setCategory('historical');
      setDescription(''); setRating('4.5'); setPrice('0');
      setHours(''); setIsPopular(false); setLat(''); setLon('');
      setImages([]);
    }
  }, [attraction]);

  const fetchImages = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/attractions/${id}/images`);
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setImages(data.data.map((img: any) => img.image_url));
      } else if (attraction?.primary_image) {
        setImages([attraction.primary_image]);
      }
    } catch {
      if (attraction?.primary_image) setImages([attraction.primary_image]);
    }
  };

  const handleAddImage = () => {
    if (!newImageUrl.trim()) return;
    if (images.length >= 5) { Alert.alert('Limit reached', 'Max 5 images.'); return; }
    const converted = convertDriveUrl(newImageUrl.trim());
    setImages(prev => [...prev, converted]);
    setNewImageUrl('');
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name || !city || !category) { Alert.alert('Error', 'Name, city and category are required.'); return; }
    if (images.length === 0) { Alert.alert('Error', 'Add at least one image.'); return; }
    onSave({
      name, city, category, description,
      // image_url: images[0],
      rating: parseFloat(rating),
      price_from: parseFloat(price),
      opening_hours: hours,
      is_popular: isPopular,
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      images,
    });
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.editModal}>
        <View style={styles.editModalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.editModalCancel}>Cancel</Text></TouchableOpacity>
          <Text style={styles.editModalTitle}>{attraction ? 'Edit Attraction' : 'Add Attraction'}</Text>
          <TouchableOpacity onPress={handleSave}><Text style={styles.editModalSave}>Save</Text></TouchableOpacity>
        </View>

        <ScrollView style={styles.editModalContent} showsVerticalScrollIndicator={false}>

          {/* ── Images Section ── */}
          <View style={styles.imageSection}>
            <Text style={styles.fieldLabel}>Images ({images.length}/5)</Text>

            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {images.map((uri, i) => (
                  <View key={i} style={styles.imageThumbContainer}>
                    <Image source={{ uri }} style={styles.imageThumb} />
                    {i === 0 && <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>Cover</Text></View>}
                    <TouchableOpacity style={styles.removeImageBtn} onPress={() => handleRemoveImage(i)}>
                      <MaterialCommunityIcons name="close" size={10} color="#FFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.addImageRow}>
              <TextInput
                style={styles.addImageInput}
                value={newImageUrl}
                onChangeText={setNewImageUrl}
                placeholder="Paste Google Drive or image URL..."
                placeholderTextColor="#AAA"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.addImageBtn} onPress={handleAddImage}>
                <Text style={styles.addImageBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={14} color="#BBB" />
              <Text style={[styles.imageHint, { marginTop: 0 }]}>Supports Google Drive share links & direct URLs</Text>
            </View>
          </View>

          {/* ── Text Fields ── */}
          {[
            { label: 'Name', value: name, setter: setName },
            { label: 'Rating (0-5)', value: rating, setter: setRating, keyboard: 'numeric' as const },
            { label: 'Price From ($)', value: price, setter: setPrice, keyboard: 'numeric' as const },
            { label: 'Opening Hours', value: hours, setter: setHours },
            { label: 'Latitude', value: lat, setter: setLat, keyboard: 'numeric' as const },
            { label: 'Longitude', value: lon, setter: setLon, keyboard: 'numeric' as const },
          ].map(field => (
            <View key={field.label} style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{field.label}</Text>
              <TextInput
                style={styles.fieldInput}
                value={field.value}
                onChangeText={field.setter}
                keyboardType={field.keyboard ?? 'default'}
                placeholderTextColor="#AAA"
              />
            </View>
          ))}

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.fieldInput, { height: 100, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              multiline
              placeholderTextColor="#AAA"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>City</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CITIES.map(c => (
                <TouchableOpacity key={c} style={[styles.pill, city === c && styles.pillActive]} onPress={() => setCity(c)}>
                  <Text style={[styles.pillText, city === c && styles.pillTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c} style={[styles.pill, category === c && styles.pillActive]} onPress={() => setCategory(c)}>
                  <Text style={[styles.pillText, category === c && styles.pillTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={[styles.fieldGroup, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            <Text style={styles.fieldLabel}>Popular Attraction</Text>
            <Switch value={isPopular} onValueChange={setIsPopular} trackColor={{ false: '#DDD', true: '#E67E22' }} thumbColor="#FFF" />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ── ATTRACTIONS SCREEN ────────────────────────────────────────────────
export default function AdminAttractionsScreen() {
  const router = useRouter();
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);

  useEffect(() => { fetchAttractions(); }, []);

  const fetchAttractions = async () => {
    try {
      const res = await fetch(`${API_BASE}/attractions`);
      const data = await res.json();
      if (data.success) setAttractions(data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleEdit = (attraction: Attraction) => { setSelectedAttraction(attraction); setEditModal(true); };

  const handleSave = async (data: Partial<Attraction> & { images: string[] }) => {
    if (!selectedAttraction) return;
    try {
      const res = await fetch(`${API_BASE}/attractions/${selectedAttraction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        setAttractions(prev => prev.map(a => a.id === selectedAttraction.id ? { ...a, ...data } : a));
        setEditModal(false);
        Alert.alert('Saved ✓', 'Attraction updated successfully.');
      }
    } catch { Alert.alert('Error', 'Could not save changes.'); }
  };

  const handleDelete = (attraction: Attraction) => {
    Alert.alert('Delete Attraction', `Delete "${attraction.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await fetch(`${API_BASE}/attractions/${attraction.id}`, { method: 'DELETE' });
            setAttractions(prev => prev.filter(a => a.id !== attraction.id));
          } catch { Alert.alert('Error', 'Could not delete attraction.'); }
        },
      },
    ]);
  };

  const filtered = attractions.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={18} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attractions ({attractions.length})</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(admin)/add-attraction' as any)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <MaterialCommunityIcons name="magnify" size={20} color="#AAA" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search attractions..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#AAA"
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#E67E22" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.attractionRow}>
              {item.primary_image ? (
                <Image source={{ uri: item.primary_image }} style={styles.attractionThumb} />
              ) : (
                <View style={[styles.attractionThumb, styles.attractionThumbEmpty]}>
                  <MaterialCommunityIcons name="bank" size={24} color="#CCC" />
                </View>
              )}
              <View style={styles.attractionInfo}>
                <Text style={styles.attractionName}>{item.name}</Text>
                <Text style={styles.attractionMeta}>
                  {item.city} · {item.category} · <MaterialCommunityIcons name="star" size={12} color="#F39C12" /> {item.rating}
                </Text>
                {item.is_popular && <View style={styles.popularBadge}><Text style={styles.popularBadgeText}>Popular</Text></View>}
              </View>
              <View style={styles.attractionActions}>
                <TouchableOpacity style={styles.editBtn} onPress={() => handleEdit(item)}>
                  <MaterialCommunityIcons name="pencil" size={16} color="#555" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                  <MaterialCommunityIcons name="trash-can" size={16} color="#E74C3C" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <EditModal
        visible={editModal}
        attraction={selectedAttraction}
        onClose={() => setEditModal(false)}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#1A1A1A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  backIcon: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  addBtn: { backgroundColor: '#E67E22', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  addBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', margin: 16, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  searchInput: { flex: 1, fontSize: 14, color: '#333' },

  attractionRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, padding: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2, gap: 12 },
  attractionThumb: { width: 56, height: 56, borderRadius: 10 },
  attractionThumbEmpty: { backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  attractionInfo: { flex: 1 },
  attractionName: { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  attractionMeta: { fontSize: 12, color: '#999', marginTop: 2 },
  popularBadge: { backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 4 },
  popularBadgeText: { color: '#E67E22', fontSize: 10, fontWeight: '700' },
  attractionActions: { flexDirection: 'row', gap: 8 },
  editBtn: { backgroundColor: '#EEF', borderRadius: 10, padding: 8 },
  editBtnText: { fontSize: 16 },
  deleteBtn: { backgroundColor: '#FEE', borderRadius: 10, padding: 8 },
  deleteBtnText: { fontSize: 16 },

  editModal: { flex: 1, backgroundColor: '#F5F5F5' },
  editModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  editModalCancel: { fontSize: 16, color: '#999' },
  editModalTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  editModalSave: { fontSize: 16, color: '#E67E22', fontWeight: '700' },
  editModalContent: { padding: 16 },

  imageSection: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 16 },
  imageThumbContainer: { width: 90, height: 90, marginRight: 10, position: 'relative' },
  imageThumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#F0F0F0' },
  primaryBadge: { position: 'absolute', top: 4, left: 4, backgroundColor: '#E67E22', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
  primaryBadgeText: { color: '#FFF', fontSize: 8, fontWeight: '800' },
  removeImageBtn: { position: 'absolute', top: 3, right: 3, backgroundColor: 'rgba(0,0,0,0.6)', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  removeImageBtnText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  addImageRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addImageInput: { flex: 1, borderWidth: 1, borderColor: '#EEE', borderRadius: 10, padding: 11, fontSize: 13, color: '#333', backgroundColor: '#FAFAFA' },
  addImageBtn: { backgroundColor: '#E67E22', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  addImageBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  imageHint: { fontSize: 11, color: '#BBB', marginTop: 6 },

  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  fieldInput: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, fontSize: 15, color: '#1A1A1A', borderWidth: 1, borderColor: '#EEE' },
  pill: { backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  pillActive: { backgroundColor: '#E67E22' },
  pillText: { fontSize: 13, color: '#666', fontWeight: '600' },
  pillTextActive: { color: '#FFF' },
});