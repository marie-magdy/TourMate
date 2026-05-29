// app/(admin)/add-attraction.tsx
import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, SafeAreaView, StatusBar, Alert, ActivityIndicator,
  Image, FlatList, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const API_BASE    = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;
const PLACES_KEY  = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY;

const CITIES     = ['Alexandria', 'Cairo', 'Hurghada', 'Luxor', 'Aswan', 'Sharm El Sheikh'];
const CATEGORIES = ['historical', 'beaches', 'restaurants', 'shopping', 'nature', 'diving', 'culture', 'nightlife', 'adventure'];

// Map Google place types → our categories
const guessCategory = (types: string[]): string => {
  if (types.some(t => ['museum', 'church', 'mosque', 'hindu_temple', 'synagogue', 'cemetery'].includes(t))) return 'historical';
  if (types.some(t => ['beach', 'natural_feature'].includes(t))) return 'beaches';
  if (types.some(t => ['restaurant', 'cafe', 'food', 'bakery'].includes(t))) return 'restaurants';
  if (types.some(t => ['shopping_mall', 'store', 'clothing_store'].includes(t))) return 'shopping';
  if (types.some(t => ['park', 'zoo', 'campground'].includes(t))) return 'nature';
  if (types.some(t => ['night_club', 'bar'].includes(t))) return 'nightlife';
  if (types.some(t => ['amusement_park', 'stadium'].includes(t))) return 'adventure';
  if (types.some(t => ['tourist_attraction', 'point_of_interest'].includes(t))) return 'historical';
  return 'historical';
};

const guessCity = (addressComponents: any[]): string => {
  for (const comp of addressComponents) {
    const name = comp.long_name?.toLowerCase() ?? '';
    if (name.includes('alexandria') || name.includes('إسكندرية')) return 'Alexandria';
    if (name.includes('cairo') || name.includes('القاهرة') || name.includes('giza') || name.includes('الجيزة')) return 'Cairo';
    if (name.includes('hurghada') || name.includes('الغردقة')) return 'Hurghada';
    if (name.includes('luxor') || name.includes('الأقصر')) return 'Luxor';
    if (name.includes('aswan') || name.includes('أسوان')) return 'Aswan';
    if (name.includes('sharm') || name.includes('شرم')) return 'Sharm El Sheikh';
  }
  return 'Cairo';
};

const formatHours = (periods: any[]): string => {
  if (!periods || periods.length === 0) return '';
  // Check if open 24/7
  if (periods.length === 1 && periods[0].open?.time === '0000' && !periods[0].close) return 'Open 24/7';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const lines = periods.map((p: any) => {
    const open  = p.open?.time  ? `${p.open.time.slice(0,2)}:${p.open.time.slice(2)}` : '';
    const close = p.close?.time ? `${p.close.time.slice(0,2)}:${p.close.time.slice(2)}` : '';
    const day   = days[p.open?.day ?? 0];
    return `${day}: ${open} - ${close}`;
  });
  // Deduplicate if all same hours
  const unique = [...new Set(lines.map(l => l.split(': ')[1]))];
  if (unique.length === 1) return `Daily: ${unique[0]}`;
  return lines.join(', ');
};

const computeOpenClose = (periods: any[]): { open_hour: number | null; close_hour: number | null } => {
  if (!periods || periods.length === 0) return { open_hour: null, close_hour: null };
  let minOpen: number | null = null;
  let maxClose: number | null = null;
  for (const p of periods) {
    const o = p.open?.time ? parseInt(p.open.time.slice(0,2), 10) : null;
    const c = p.close?.time ? parseInt(p.close.time.slice(0,2), 10) : null;
    if (o != null && (minOpen == null || o < minOpen)) minOpen = o;
    if (c != null && (maxClose == null || c > maxClose)) maxClose = c;
  }
  return { open_hour: minOpen, close_hour: maxClose };
};

// admin uses separate numeric open/close hour fields now

export default function AddAttractionScreen() {
  const router = useRouter();

  const [name, setName]           = useState('');
  const [city, setCity]           = useState('Alexandria');
  const [categories, setCategories] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [rating, setRating]       = useState('4.5');
  const [price, setPrice]         = useState('0');
  const [openHour, setOpenHour]   = useState('');
  const [closeHour, setCloseHour] = useState('');
  const [lat, setLat]             = useState('');
  const [lon, setLon]             = useState('');
  const [images, setImages]       = useState<string[]>([]);
  const [driveUrl, setDriveUrl]   = useState('');
  const [saving, setSaving]       = useState(false);

  // Google Places state
  const [suggestions, setSuggestions]     = useState<any[]>([]);
  const [loadingPlace, setLoadingPlace]   = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeout = useRef<any>(null);

  // ── Google Places Autocomplete ────────────────────────────────────
  const handleNameChange = (text: string) => {
    setName(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (text.length < 3) { setSuggestions([]); setShowSuggestions(false); return; }
    searchTimeout.current = setTimeout(() => searchPlaces(text), 500);
  };

  const searchPlaces = async (query: string) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:eg&key=${PLACES_KEY}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.predictions?.length > 0) {
        setSuggestions(data.predictions);
        setShowSuggestions(true);
      }
    } catch { /* silent fail */ }
  };

  const handleSelectPlace = async (prediction: any) => {
    setShowSuggestions(false);
    const placeName = prediction.structured_formatting?.main_text ?? prediction.description;
    setName(placeName);
    setLoadingPlace(true);
    try {
      const fields = 'name,rating,geometry,opening_hours,photos,address_components,formatted_address,price_level,editorial_summary,types';
      const url    = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=${fields}&key=${PLACES_KEY}`;
      const res    = await fetch(url);
      const data   = await res.json();
      const place  = data.result;

      if (place) {
        // Build all data locally first
        const finalName   = place.name ?? placeName;
        const finalDesc   = place.editorial_summary?.overview ?? '';
        const finalRating = place.rating ? String(place.rating) : '4.5';
        const finalLat    = place.geometry?.location?.lat ? String(place.geometry.location.lat) : '';
        const finalLon    = place.geometry?.location?.lng ? String(place.geometry.location.lng) : '';
        const finalHours  = place.opening_hours?.periods
          ? formatHours(place.opening_hours.periods)
          : place.opening_hours?.weekday_text?.join(' | ') ?? '';
        const { open_hour, close_hour } = place.opening_hours?.periods
          ? computeOpenClose(place.opening_hours.periods)
          : { open_hour: null, close_hour: null };
        const finalCity     = place.address_components ? guessCity(place.address_components) : city;
        const finalCategory = place.types ? guessCategory(place.types) : null;
        const finalCategories = finalCategory ? [finalCategory] : categories;
        const finalImages   = place.photos?.length > 0
          ? place.photos.slice(0, 5).map((p: any) =>
              `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${PLACES_KEY}`)
          : [];

        // Update state for display
        setName(finalName);
        setDescription(finalDesc);
        setRating(finalRating);
        setLat(finalLat);
        setLon(finalLon);
        setOpenHour(open_hour != null ? String(open_hour) : '');
        setCloseHour(close_hour != null ? String(close_hour) : '');
        setCity(finalCity);
        setCategories(finalCategories);
        setImages(finalImages);

        // Auto-save directly to DB
        setSaving(true);
        const body = {
          name: finalName,
          city: finalCity,
          categories: finalCategories,
          description: finalDesc,
          // image_url: finalImages[0] ?? '',
          rating: parseFloat(finalRating) || 4.0,
          price_from: 0,
          open_hour,
          close_hour,
          latitude: parseFloat(finalLat) || null,
          longitude: parseFloat(finalLon) || null,
          images: finalImages,
        };
        const saveRes  = await fetch(`${API_BASE}/attractions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const saveData = await saveRes.json();
        if (saveData.success) {
          Alert.alert('Saved ✓', `"${finalName}" has been auto-filled and saved to the database!`, [
            { text: 'Add Another', onPress: resetForm },
            { text: 'Done', onPress: () => router.back() },
          ]);
        } else {
          Alert.alert('Filled but not saved', saveData.message ?? 'Auto-fill worked but saving failed. Edit details and press Save manually.');
        }
      }
    } catch { Alert.alert('Error', 'Could not fetch place details.'); }
    finally { setLoadingPlace(false); setSaving(false); }
  };

  // ── Manual image URL ──────────────────────────────────────────────
  const convertDriveUrl = (url: string): string => {
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
    return url.trim();
  };

  const handleAddUrl = () => {
    if (!driveUrl.trim()) return;
    if (images.length >= 5) { Alert.alert('Limit reached', 'Max 5 images.'); return; }
    setImages(prev => [...prev, convertDriveUrl(driveUrl.trim())]);
    setDriveUrl('');
  };

  const handleRemoveImage = (index: number) => setImages(prev => prev.filter((_, i) => i !== index));

  const toggleCategory = (c: string) => {
    setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  // ── Save ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name is required.'); return; }
    setSaving(true);
    try {
      const parsedOpen  = openHour.trim() ? parseInt(openHour.trim(), 10) : undefined;
      const parsedClose = closeHour.trim() ? parseInt(closeHour.trim(), 10) : undefined;
      const res  = await fetch(`${API_BASE}/attractions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), city, categories,
          description: description.trim(),
          // image_url: images[0],
          rating: parseFloat(rating) || 4.0,
          price_from: parseFloat(price) || 0,
          open_hour: parsedOpen,
          close_hour: parsedClose,
          latitude: parseFloat(lat) || null,
          longitude: parseFloat(lon) || null,
          images,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert('Added ✓', `"${name}" saved!`, [
          { text: 'Add Another', onPress: resetForm },
          { text: 'Done', onPress: () => router.back() },
        ]);
      } else {
        Alert.alert('Error', data.message ?? 'Could not save.');
      }
    } catch { Alert.alert('Error', 'Could not connect to server.'); }
    finally { setSaving(false); }
  };

  const resetForm = () => {
    setName(''); setDescription(''); setRating('4.5'); setPrice('0');
    setOpenHour(''); setCloseHour(''); setLat(''); setLon(''); setImages([]);
    setCategories([]);
    setSuggestions([]); setShowSuggestions(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1A1A" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Attraction</Text>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Google Places Search ── */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <MaterialCommunityIcons name="magnify" size={18} color="#1A1A1A" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Search & Auto-fill</Text>
          </View>
          <Text style={styles.sectionHint}>Type an attraction name to auto-fill all details from Google</Text>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={name}
              onChangeText={handleNameChange}
              placeholder="e.g. Pyramids of Giza..."
              placeholderTextColor="#AAA"
              autoCorrect={false}
            />
            {loadingPlace && <ActivityIndicator color="#E67E22" style={{ marginLeft: 10 }} />}
          </View>

          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsList}>
              {suggestions.map((item) => (
                <TouchableOpacity
                  key={item.place_id}
                  style={styles.suggestionItem}
                  onPress={() => handleSelectPlace(item)}
                >
                  <Text style={styles.suggestionMain}>{item.structured_formatting?.main_text ?? item.description}</Text>
                  <Text style={styles.suggestionSecondary}>{item.structured_formatting?.secondary_text ?? ''}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setShowSuggestions(false)} style={styles.dismissBtn}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Images ── */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <MaterialCommunityIcons name="camera" size={18} color="#1A1A1A" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Images ({images.length}/5)</Text>
          </View>
          {images.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
              {images.map((uri, i) => (
                <View key={i} style={styles.imageThumbContainer}>
                  <Image source={{ uri }} style={styles.imageThumb} />
                  {i === 0 && <View style={styles.primaryBadge}><Text style={styles.primaryBadgeText}>Cover</Text></View>}
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => handleRemoveImage(i)}>
                    <MaterialCommunityIcons name="close" size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noImagesHint}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="image-multiple-outline" size={16} color="#BBB" />
                <Text style={styles.noImagesText}>Images auto-fill from Google Places</Text>
              </View>
              <Text style={styles.noImagesSubText}>Or paste a Drive/image URL below</Text>
            </View>
          )}

          <View style={styles.urlRow}>
            <TextInput
              style={styles.urlInput}
              value={driveUrl}
              onChangeText={setDriveUrl}
              placeholder="Or paste Google Drive / image URL..."
              placeholderTextColor="#AAA"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.addUrlBtn} onPress={handleAddUrl}>
              <Text style={styles.addUrlBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Basic Info ── */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <MaterialCommunityIcons name="note-edit-outline" size={18} color="#1A1A1A" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Details</Text>
          </View>

          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} placeholder="Auto-filled from Google or type here..." placeholderTextColor="#AAA" multiline textAlignVertical="top" />

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Open Hour (24h)</Text>
              <TextInput style={styles.input} value={openHour} onChangeText={setOpenHour} placeholder="e.g. 9" placeholderTextColor="#AAA" keyboardType="numeric" />
            </View>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Close Hour (24h)</Text>
              <TextInput style={styles.input} value={closeHour} onChangeText={setCloseHour} placeholder="e.g. 17" placeholderTextColor="#AAA" keyboardType="numeric" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Rating (0–5)</Text>
              <TextInput style={styles.input} value={rating} onChangeText={setRating} keyboardType="decimal-pad" />
            </View>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Price From ($)</Text>
              <TextInput style={styles.input} value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Latitude</Text>
              <TextInput style={styles.input} value={lat} onChangeText={setLat} keyboardType="decimal-pad" placeholder="Auto-filled" placeholderTextColor="#AAA" />
            </View>
            <View style={styles.half}>
              <Text style={styles.fieldLabel}>Longitude</Text>
              <TextInput style={styles.input} value={lon} onChangeText={setLon} keyboardType="decimal-pad" placeholder="Auto-filled" placeholderTextColor="#AAA" />
            </View>
          </View>
        </View>

        {/* ── City ── */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <MaterialCommunityIcons name="city" size={18} color="#1A1A1A" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>City <Text style={styles.autoTag}>auto-detected</Text></Text>
          </View>
          <View style={styles.pillsRow}>
            {CITIES.map(c => (
              <TouchableOpacity key={c} style={[styles.pill, city === c && styles.pillActive]} onPress={() => setCity(c)}>
                <Text style={[styles.pillText, city === c && styles.pillTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Category ── */}
        <View style={styles.section}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <MaterialCommunityIcons name="tag-outline" size={18} color="#1A1A1A" />
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Category <Text style={styles.autoTag}>auto-detected</Text></Text>
          </View>
          <View style={styles.pillsRow}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c} style={[styles.pill, categories.includes(c) && styles.pillActive]} onPress={() => toggleCategory(c)}>
                <Text style={[styles.pillText, categories.includes(c) && styles.pillTextActive]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Popular toggle removed from admin UI */}

        <TouchableOpacity style={[styles.saveFullBtn, { flexDirection: 'row', justifyContent: 'center', gap: 8 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFF" /> : (
            <>
              <MaterialCommunityIcons name="check" size={20} color="#FFF" />
              <Text style={styles.saveFullBtnText}>Add Attraction to Database</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:  { flex: 1, backgroundColor: '#F5F5F5' },
  container: { flex: 1 },
  header:    { backgroundColor: '#1A1A1A', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  backBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  backIcon:  { color: '#FFF', fontSize: 18, fontWeight: '700' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFF' },
  saveBtn:   { backgroundColor: '#E67E22', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, minWidth: 60, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },

  section:      { backgroundColor: '#FFF', marginHorizontal: 16, marginTop: 16, borderRadius: 20, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A', marginBottom: 4 },
  sectionHint:  { fontSize: 12, color: '#AAA', marginBottom: 12, lineHeight: 18 },
  autoTag:      { fontSize: 11, color: '#E67E22', fontWeight: '600', textTransform: 'none' },

  searchRow:  { flexDirection: 'row', alignItems: 'center' },
  searchInput:{ flex: 1, borderWidth: 1.5, borderColor: '#E67E22', borderRadius: 14, padding: 13, fontSize: 15, color: '#1A1A1A', backgroundColor: '#FFFAF5' },

  suggestionsList: { marginTop: 8, borderWidth: 1, borderColor: '#EEE', borderRadius: 14, overflow: 'hidden', backgroundColor: '#FFF' },
  suggestionItem:  { padding: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  suggestionMain:  { fontSize: 14, fontWeight: '700', color: '#1A1A1A' },
  suggestionSecondary: { fontSize: 12, color: '#999', marginTop: 2 },
  dismissBtn:  { padding: 12, alignItems: 'center', backgroundColor: '#F9F9F9' },
  dismissText: { fontSize: 13, color: '#AAA' },

  imagesScroll:        { marginBottom: 14 },
  imageThumbContainer: { width: 100, height: 100, marginRight: 10, position: 'relative' },
  imageThumb:          { width: 100, height: 100, borderRadius: 12, backgroundColor: '#F0F0F0' },
  primaryBadge:        { position: 'absolute', top: 6, left: 6, backgroundColor: '#E67E22', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  primaryBadgeText:    { color: '#FFF', fontSize: 9, fontWeight: '800' },
  removeImageBtn:      { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  removeImageBtnText:  { color: '#FFF', fontSize: 10, fontWeight: '700' },
  noImagesHint:        { alignItems: 'center', paddingVertical: 20, marginBottom: 8 },
  noImagesText:        { fontSize: 14, color: '#BBB', fontWeight: '600' },
  noImagesSubText:     { fontSize: 12, color: '#CCC', marginTop: 4 },

  urlRow:     { flexDirection: 'row', gap: 10, marginTop: 4 },
  urlInput:   { flex: 1, borderWidth: 1, borderColor: '#EEE', borderRadius: 12, padding: 13, fontSize: 13, color: '#333', backgroundColor: '#FAFAFA' },
  addUrlBtn:  { backgroundColor: '#E67E22', borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  addUrlBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#999', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 12 },
  input:      { borderWidth: 1, borderColor: '#EEE', borderRadius: 12, padding: 13, fontSize: 15, color: '#1A1A1A', backgroundColor: '#FAFAFA' },
  textArea:   { height: 100, textAlignVertical: 'top' },

  pillsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill:          { backgroundColor: '#F5F5F5', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  pillActive:    { backgroundColor: '#E67E22' },
  pillText:      { fontSize: 13, color: '#666', fontWeight: '600' },
  pillTextActive:{ color: '#FFF' },

  row:  { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },

  toggleRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  saveFullBtn:  { backgroundColor: '#1A1A1A', marginHorizontal: 16, marginTop: 20, borderRadius: 20, paddingVertical: 18, alignItems: 'center' },
  saveFullBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});