import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import NearestCard from '../../components/NearestCard';
import AttractionSheet from '../../components/AttractionSheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Attraction } from '../../constants/types';
import { Dimensions } from 'react-native';

const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;
const PER_PAGE = 20;


export default function FilteredResultsPage() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [results, setResults] = useState<Attraction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedAttraction, setSelectedAttraction] = useState<Attraction | null>(null);
  const resultsCountRef = useRef(0);
  const [showSheet, setShowSheet] = useState(false);

  const buildFiltersFromParams = () => {
    return {
      categories: params.categories ? String(params.categories).split(',').map(s => s.trim()).filter(Boolean) : [],
      maxPrice: params.maxPrice ? Number(params.maxPrice) : null,
      minRating: params.minRating ? Number(params.minRating) : 0,
      city: params.city ? String(params.city) : '',
    } as any;
  };

  const fetchPage = async (pageNum = 1, append = false) => {
    const filters = buildFiltersFromParams();
    try {
      if (append) setLoadingMore(true); else setLoading(true);
      const prevCount = resultsCountRef.current;
      const qp = new URLSearchParams();
      if (filters.categories.length) qp.set('categories', filters.categories.join(','));
      if (filters.maxPrice != null) qp.set('maxPrice', String(filters.maxPrice));
      if (filters.minRating > 0) qp.set('minRating', String(filters.minRating));
      if (filters.city && filters.city.trim()) qp.set('city', filters.city.trim());
      qp.set('page', String(pageNum));
      qp.set('per_page', String(PER_PAGE));

      const res = await fetch(`${API_BASE}/attractions/filter?${qp.toString()}`);
      const data = await res.json();
      if (data && data.success) {
        const pageItems: Attraction[] = data.data ?? [];
        if (append) {
          if ((pageItems.length ?? 0) === 0) {
            // server returned empty page — no more results
            setHasMore(false);
          }
          setResults(prev => {
            const combined = [...prev, ...pageItems];
            const map = new Map<number, Attraction>();
            for (const it of combined) map.set(Number(it.id), it);
            const arr = Array.from(map.values());
            resultsCountRef.current = arr.length;
            return arr;
          });
        } else {
          // ensure unique by id for the first page
          const map = new Map<number, Attraction>();
          for (const it of pageItems) map.set(Number(it.id), it);
          const arr = Array.from(map.values());
          setResults(arr);
          resultsCountRef.current = arr.length;
        }

        setTotal(typeof data.total === 'number' ? data.total : null);

        // determine if there are more pages: if server returned total, compare;
        // otherwise infer from page size.
        const newCount = resultsCountRef.current;
        if (typeof data.total === 'number') {
          setHasMore(newCount < data.total);
        } else {
          setHasMore((pageItems.length ?? 0) === PER_PAGE);
        }

        // Defensive: if an append didn't increase unique results, stop further loads
        if (append && newCount === prevCount) {
          setHasMore(false);
        }

        setPage(data.page ?? pageNum);
      }
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  };

  useEffect(() => {
    // load first page when params change
    setResults([]); setPage(1); setTotal(null);
    setHasMore(true);
    resultsCountRef.current = 0;
    fetchPage(1, false);
  }, [JSON.stringify(params)]);

  const loadMore = () => {
    if (loadingMore) return;
    if (!hasMore) return;
    if (total != null && results.length >= total) return;
    fetchPage(page + 1, true);
  };

  const { width, height } = Dimensions.get('window');
  const triangleCount = 35;
  const triangles = Array.from({ length: triangleCount }).map((_, i) => {
    const size = Math.random() * 16 + 10;
    const top = i * 80 + Math.random() * 30;
    const left = i % 3 === 0 ? Math.random() * 30 : i % 3 === 1 ? 35 + Math.random() * 30 : 70 + Math.random() * 25;
    const opacity = Math.random() * 0.2 + 0.08;
    return (
      <View key={i} style={{ position: 'absolute', left: `${left}%`, top, width: 0, height: 0, borderLeftWidth: size, borderRightWidth: size, borderBottomWidth: size * 1.4, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: `rgba(224,123,57,${opacity})` }} />
    );
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ position: 'relative', flex: 1 }}>
        {triangles}
        <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>Filtered Results</Text>
          {total != null && <Text style={{ color: '#666', marginTop: 4 }}>{total} results</Text>}
        </View>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <MaterialCommunityIcons name="close" size={22} color="#333" />
        </TouchableOpacity>
      </View>

      {loading && results.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#E67E22" />
        </View>
        ) : (
          <FlatList
          data={results}
          keyExtractor={(item, index) => `${String(item.id)}-${index}`}
          renderItem={({ item }) => <NearestCard item={item as any} onPress={(a) => { setSelectedAttraction(a); setShowSheet(true); }} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => loadMore()}
          ListFooterComponent={() => (
            <View style={{ padding: 16, alignItems: 'center' }}>
              {loadingMore ? (
                  <ActivityIndicator color="#E67E22" />
                ) : (
                  hasMore ? (
                    <TouchableOpacity onPress={loadMore} style={{ backgroundColor: '#E67E22', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 }}>
                      <Text style={{ color: '#FFF', fontWeight: '800' }}>Load more</Text>
                    </TouchableOpacity>
                  ) : (
                    <Text style={{ color: '#999', fontSize: 13 }}>No more results</Text>
                  )
                )}
            </View>
          )}
        />
      )}
      </View>
      <AttractionSheet
        attraction={selectedAttraction}
        visible={showSheet}
        onClose={() => setShowSheet(false)}
        userLocation={null}
        userId={null}
        onGetDirections={({ latitude, longitude, name }) => {
          setShowSheet(false);
          router.push({ pathname: '/(main)/map', params: { destLat: String(latitude), destLng: String(longitude), destName: name } } as any);
        }}
      />
      
    </SafeAreaView>
  );
}
