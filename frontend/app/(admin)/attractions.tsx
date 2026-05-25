// app/(admin)/attractions.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, SafeAreaView, StatusBar,
  TextInput, Modal, ScrollView, Image,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;

interface Attraction {
  id: number;
  name: string;
  city: string;
  city_id?: number;
  categories?: string[];
  category?: string; // optional fallback
  description: string;
  primary_image: string;
  rating: number;
  price_from: number;
  open_hour?: number;
  close_hour?: number;
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

// ── Toast ─────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning';

const Toast: React.FC<{ message: string; type: ToastType; visible: boolean }> = ({ message, type, visible }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const bgColor = type === 'success' ? '#27AE60' : type === 'error' ? '#C0392B' : '#E67E22';
  const icon: any = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'alert';

  return (
    <Animated.View style={[toastStyles.container, { backgroundColor: bgColor, opacity, transform: [{ translateY }] }]}>
      <MaterialCommunityIcons name={icon} size={18} color="#FFF" />
      <Text style={toastStyles.text}>{message}</Text>
    </Animated.View>
  );
};

const toastStyles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 32, left: 16, right: 16, zIndex: 999,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 14, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },
  text: { color: '#FFF', fontSize: 14, fontWeight: '600', flex: 1 },
});

// ── useToast hook ─────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: '', type: 'success', visible: false,
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = (message: string, type: ToastType = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type, visible: true });
    timerRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  };

  return { toast, show };
}

// ── Confirm Dialog ────────────────────────────────────────────────────
const ConfirmDialog: React.FC<{
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ visible, title, message, confirmText = 'Confirm', confirmColor = '#E74C3C', onConfirm, onCancel }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={dialogStyles.overlay}>
      <View style={dialogStyles.card}>
        <Text style={dialogStyles.title}>{title}</Text>
        <Text style={dialogStyles.message}>{message}</Text>
        <View style={dialogStyles.actions}>
          <TouchableOpacity style={dialogStyles.cancelBtn} onPress={onCancel}>
            <Text style={dialogStyles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[dialogStyles.confirmBtn, { backgroundColor: confirmColor }]} onPress={onConfirm}>
            <Text style={dialogStyles.confirmText}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const dialogStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  card: { backgroundColor: '#FFF', borderRadius: 20, padding: 24, width: '100%' },
  title: { fontSize: 17, fontWeight: '800', color: '#1A1A1A', marginBottom: 8 },
  message: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 24 },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: '#EEE', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#999', fontWeight: '700', fontSize: 14 },
  confirmBtn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  confirmText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});

// ── Edit Modal ────────────────────────────────────────────────────────
const EditModal: React.FC<{
  visible: boolean;
  attraction: Attraction | null;
  onClose: () => void;
  onSave: (data: Partial<Attraction> & { images: string[]; categories: string[] }) => void;
  showToast: (message: string, type: ToastType) => void;
}> = ({ visible, attraction, onClose, onSave, showToast }) => {
  const [name, setName] = useState('');
  const [city, setCity] = useState('Alexandria');
  const [categories, setCategories] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [rating, setRating] = useState('4.5');
  const [price, setPrice] = useState('0');
  const [openHour, setOpenHour] = useState('');
  const [closeHour, setCloseHour] = useState('');
  
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');

  useEffect(() => {
    if (attraction) {
      setName(attraction.name);
      setCity(attraction.city);
      // ✅ use categories array, fallback to splitting old category string
      setCategories(
        attraction.categories && attraction.categories.length > 0
          ? attraction.categories
          : attraction.category ? [attraction.category] : []
      );
      setDescription(attraction.description ?? '');
      setRating(String(attraction.rating));
      setPrice(String(attraction.price_from));
      setOpenHour(attraction.open_hour != null ? String(attraction.open_hour) : '');
      setCloseHour(attraction.close_hour != null ? String(attraction.close_hour) : '');
      setLat(String(attraction.latitude ?? ''));
      setLon(String(attraction.longitude ?? ''));
      fetchImages(attraction.id);
    } else {
      setName(''); setCity('Alexandria'); setCategories([]);
      setDescription(''); setRating('4.5'); setPrice('0');
      setOpenHour(''); setCloseHour(''); setLat(''); setLon('');
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
    if (images.length >= 5) {
      showToast('Maximum 5 images allowed', 'warning');
      return;
    }
    const converted = convertDriveUrl(newImageUrl.trim());
    setImages(prev => [...prev, converted]);
    setNewImageUrl('');
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const toggleCategory = (c: string) => {
    setCategories(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const handleSave = () => {
    // ✅ validate using categories array, not category string
    if (!name.trim()) { showToast('Name is required', 'error'); return; }
    if (!city) { showToast('Please select a city', 'error'); return; }
    if (categories.length === 0) { showToast('Select at least one category', 'error'); return; }
    if (images.length === 0) { showToast('Add at least one image', 'error'); return; }
    const parsedOpen = openHour.trim() ? parseInt(openHour.trim(), 10) : undefined;
    const parsedClose = closeHour.trim() ? parseInt(closeHour.trim(), 10) : undefined;

    onSave({
      name,
      city,
      categories, // array
      description,
      rating: parseFloat(rating),
      price_from: parseFloat(price),
      open_hour: parsedOpen,
      close_hour: parsedClose,
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      images,
    });
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.editModal}>
        <View style={styles.editModalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.editModalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.editModalTitle}>{attraction ? 'Edit Attraction' : 'Add Attraction'}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.editModalSave}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.editModalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── Images ── */}
          <View style={styles.imageSection}>
            <Text style={styles.fieldLabel}>Images ({images.length}/5)</Text>
            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {images.map((uri, i) => (
                  <View key={i} style={styles.imageThumbContainer}>
                    <Image source={{ uri }} style={styles.imageThumb} />
                    {i === 0 && (
                      <View style={styles.primaryBadge}>
                        <Text style={styles.primaryBadgeText}>Cover</Text>
                      </View>
                    )}
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
              <Text style={styles.imageHint}>Supports Google Drive share links & direct URLs</Text>
            </View>
          </View>

          {/* ── Text Fields ── */}
          {[
            { label: 'Name', value: name, setter: setName },
            { label: 'Rating (0-5)', value: rating, setter: setRating, keyboard: 'numeric' as const },
            { label: 'Price From ($)', value: price, setter: setPrice, keyboard: 'numeric' as const },
            { label: 'Open Hour (0-23)', value: openHour, setter: setOpenHour, keyboard: 'numeric' as const },
            { label: 'Close Hour (0-23)', value: closeHour, setter: setCloseHour, keyboard: 'numeric' as const },
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

          {/* ── City pills (single select) ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>City</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CITIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pill, city === c && styles.pillActive]}
                  onPress={() => setCity(c)}
                >
                  <Text style={[styles.pillText, city === c && styles.pillTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── Category pills (multi select) ── */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Categories {categories.length > 0 && `(${categories.length} selected)`}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {CATEGORIES.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pill, categories.includes(c) && styles.pillActive]}
                  onPress={() => toggleCategory(c)}
                >
                  {categories.includes(c) && (
                    <MaterialCommunityIcons name="check" size={12} color="#FFF" style={{ marginRight: 4 }} />
                  )}
                  <Text style={[styles.pillText, categories.includes(c) && styles.pillTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Popular toggle removed from admin edit modal */}

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
  const [confirmDialog, setConfirmDialog] = useState<{
    visible: boolean; title: string; message: string; onConfirm: () => void;
  }>({ visible: false, title: '', message: '', onConfirm: () => {} });
  const { toast, show: showToast } = useToast();

  useFocusEffect(
    useCallback(() => {
      fetchAttractions();
    }, [])
  );

  const fetchAttractions = async () => {
    try {
      const res = await fetch(`${API_BASE}/attractions`);
      const data = await res.json();
      if (data.success) setAttractions(data.data);
      else showToast('Could not load attractions', 'error');
    } catch {
      showToast('Network error loading attractions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (attraction: Attraction) => {
    setSelectedAttraction(attraction);
    setEditModal(true);
  };

  const handleSave = async (data: Partial<Attraction> & { images: string[]; categories: string[] }) => {
    if (!selectedAttraction) return;
    try {
      const res = await fetch(`${API_BASE}/attractions/${selectedAttraction.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        setAttractions(prev =>
          prev.map(a => a.id === selectedAttraction.id ? { ...a, ...data } : a)
        );
        setEditModal(false);
        showToast('Attraction updated successfully', 'success');
      } else {
        showToast(result.message ?? 'Could not save changes', 'error');
      }
    } catch {
      showToast('Network error — could not save', 'error');
    }
  };

  const handleDelete = (attraction: Attraction) => {
    setConfirmDialog({
      visible: true,
      title: 'Delete Attraction',
      message: `Delete "${attraction.name}"? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(d => ({ ...d, visible: false }));
        try {
          await fetch(`${API_BASE}/attractions/${attraction.id}`, { method: 'DELETE' });
          setAttractions(prev => prev.filter(a => a.id !== attraction.id));
          showToast(`"${attraction.name}" deleted`, 'success');
        } catch {
          showToast('Could not delete attraction', 'error');
        }
      },
    });
  };

  const filtered = attractions.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />

      {/* Toast sits at the top of the screen */}
      <Toast message={toast.message} type={toast.type} visible={toast.visible} />

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
                  {item.city} ·{' '}
                  {/* ✅ show categories array joined, fallback to category string */}
                  {(item.categories && item.categories.length > 0)
                    ? item.categories.join(', ')
                    : item.category ?? '—'
                  } · <MaterialCommunityIcons name="star" size={12} color="#F39C12" /> {item.rating}
                </Text>
                {/* Removed Popular badge — admin no longer marks popularity */}
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
        showToast={showToast}
      />

      <ConfirmDialog
        visible={confirmDialog.visible}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText="Delete"
        confirmColor="#E74C3C"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(d => ({ ...d, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#1A1A1A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
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
  /* popularBadge styles removed as UI no longer displays Popular tag */
  attractionActions: { flexDirection: 'row', gap: 8 },
  editBtn: { backgroundColor: '#EEF', borderRadius: 10, padding: 8 },
  deleteBtn: { backgroundColor: '#FEE', borderRadius: 10, padding: 8 },

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
  addImageRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  addImageInput: { flex: 1, borderWidth: 1, borderColor: '#EEE', borderRadius: 10, padding: 11, fontSize: 13, color: '#333', backgroundColor: '#FAFAFA' },
  addImageBtn: { backgroundColor: '#E67E22', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  addImageBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  imageHint: { fontSize: 11, color: '#BBB' },

  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  fieldInput: { backgroundColor: '#FFF', borderRadius: 14, padding: 14, fontSize: 15, color: '#1A1A1A', borderWidth: 1, borderColor: '#EEE' },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  pillActive: { backgroundColor: '#E67E22' },
  pillText: { fontSize: 13, color: '#666', fontWeight: '600' },
  pillTextActive: { color: '#FFF' },
});