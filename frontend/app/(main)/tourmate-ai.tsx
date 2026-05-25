// app/(main)/tourmate-ai.tsx
import React, { useState, useRef, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, Dimensions, Image, Alert,
  Animated,Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../../constants/AppContext';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { API_BASE } from '../../constants/api';
import ScreenWrapper from '../../components/ScreenWrapper';
import BottomTab from '@/components/BottomTab';
import { Keyboard } from 'react-native';


import DesertTriangles from '../../components/DesertTriangles';
import { Theme } from '../../constants/theme';

import { VoiceScreen } from './VoiceScreen';
import { Ionicons } from '@expo/vector-icons';

const BOTTOM_TAB_HEIGHT = 60; // adjust to match your BottomTab height

const { width } = Dimensions.get('window');
const API_KEY  = process.env.EXPO_PUBLIC_API_KEY ?? '';
const PREMIUM_POINTS_REQUIRED = 200;

// ── Types ─────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  image?: string; // uri — from landmark recognition
}

const SUGGESTIONS = [
  '🏛️ Tell me about the Pyramids',
  '🗺️ Plan 3 days in Cairo',
  '🤿 Best diving in Hurghada',
  '🍽️ Must-try Egyptian food',
  '💰 Budget tips for Egypt',
  '🌡️ Best time to visit Luxor',
  '🎒 What to pack for Sharm?',
  '⚠️ Safety tips for tourists',
];

// ── Message Bubble ────────────────────────────────────────────────────
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const soundRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const handleSpeak = async () => {
    if (paused && soundRef.current) {
      await soundRef.current.playAsync();
      setSpeaking(true); setPaused(false); return;
    }
    if (speaking && soundRef.current) {
      await soundRef.current.pauseAsync();
      setSpeaking(false); setPaused(true); return;
    }
    setLoadingAudio(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const res = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: message.content, language: 'en' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error('TTS failed');
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${data.audio}` },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setSpeaking(true); setPaused(false);
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          setSpeaking(false); setPaused(false); soundRef.current = null;
        }
      });
    } catch (err) {
      console.error('Speak error:', err);
    } finally {
      setLoadingAudio(false);
    }
  };

  return (
    
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarIcon}>🧳</Text>
        </View>
      )}
      <View style={{ maxWidth: width * 0.72 }}>
        {/* Landmark image (from CV recognition) */}
        {message.image && (
          <Image
            source={{ uri: message.image }}
            style={[styles.messageImage, isUser && styles.messageImageUser]}
            resizeMode="cover"
          />
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {message.content}
          </Text>
          <Text style={[styles.bubbleTime, isUser && styles.bubbleTimeUser]}>
            {message.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        {!isUser && (
          <TouchableOpacity
            style={[styles.speakBtn, speaking && styles.speakBtnActive, paused && styles.speakBtnPaused]}
            onPress={handleSpeak}
            disabled={loadingAudio}
            activeOpacity={0.8}
          >
            {loadingAudio
              ? <ActivityIndicator size="small" color="#E67E22" />
              : <Text style={[styles.speakBtnText, speaking && styles.speakBtnTextActive, paused && styles.speakBtnTextPaused]}>
                  {speaking ? '⏸ Pause' : paused ? '▶ Resume' : '🔊 Listen'}
                </Text>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};


// ── Voice Mode Overlay ────────────────────────────────────────────────
const VoiceModeOverlay: React.FC<{
  onClose: () => void;
  onTranscribed: (text: string) => void;
  isProcessing: boolean;
  isSpeaking: boolean;
  lastResponse: string;
  isFemale: boolean;
  onToggleGender: () => void;
}> = ({ onClose, onTranscribed, isProcessing, isSpeaking, lastResponse, isFemale, onToggleGender }) => {
  const [isRecording, setIsRecording]   = useState(false);
  const [recordingDone, setRecordingDone] = useState(false);
  const [status, setStatus]             = useState('Tap the mic to speak');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const pulseLoop    = useRef<Animated.CompositeAnimation | null>(null);

  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    pulseLoop.current?.stop();
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  };

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { setStatus('Microphone permission denied'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDone(false);
      setStatus('Listening...');
      startPulse();
    } catch (err) {
      console.error('Recording error:', err);
      setStatus('Could not start recording');
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    stopPulse();
    setIsRecording(false);
    setStatus('Processing your voice...');
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No recording URI');

      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const res = await fetch(`${API_BASE}/ai/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType: 'audio/m4a' }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        setStatus(`You said: "${data.text}"`);
        setRecordingDone(true);
        onTranscribed(data.text);
      } else {
        setStatus("Couldn't understand. Try again.");
      }
    } catch (err) {
      console.error('Transcribe error:', err);
      setStatus("Couldn't process audio. Try again.");
    }
  };

  useEffect(() => {
    return () => { recordingRef.current?.stopAndUnloadAsync().catch(() => {}); };
  }, []);

  const getStatusText = () => {
    if (isProcessing) return '🧠 Thinking...';
    if (isSpeaking)   return '🔊 Speaking...';
    if (isRecording)  return '🎤 Listening... tap to stop';
    if (recordingDone && lastResponse) return lastResponse.slice(0, 100) + (lastResponse.length > 100 ? '...' : '');
    return status;
  };

  return (
  <VoiceScreen
    isFemale={isFemale}
    isSpeaking={isSpeaking}
    isThinking={isProcessing}
    isListening={isRecording}
    isRecording={isRecording}
    statusText={getStatusText()}
    onClose={onClose}
    onToggleGender={onToggleGender}
    onToggleMic={isRecording ? stopRecording : startRecording}
    onStop={onClose}
  />

  );
};

// ── Main Screen ───────────────────────────────────────────────────────
export default function TourMateAIScreen() {
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const router = useRouter();
  const { t, userId, voiceChatEnabled, refreshFeatures } = useApp();
  const scrollRef = useRef<ScrollView>(null);

  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const [messages, setMessages] = useState<Message[]>([{
    id: '0',
    role: 'assistant',
    content: "👋 Hello! I'm Tour Mate, your personal Egyptian travel assistant!\n\nI can help you with:\n🏛️ Historical places & monuments\n🗺️ Trip planning & itineraries\n💰 Budget advice & cost estimates\n🍽️ Local food recommendations\n🎒 Packing tips by city & season\n⚠️ Safety tips for tourists\n📸 Identify landmarks from photos!\n\nWhat would you like to know about Egypt?",
    timestamp: new Date(),
  }]);
  const [input, setInput]                           = useState('');
  const [loading, setLoading]                       = useState(false);
  const [recognizing, setRecognizing]               = useState(false);
  const [voiceMode, setVoiceMode]                   = useState(false);
  const [isSpeakingResponse, setIsSpeakingResponse] = useState(false);
  const [isFemaleAvatar, setIsFemaleAvatar]         = useState(false);
  const [points, setPoints]                         = useState<number | null>(null);
  const [loadingPoints, setLoadingPoints]           = useState(false);
  const activeSoundRef = useRef<any>(null);

  const premiumUnlocked = (points ?? 0) >= PREMIUM_POINTS_REQUIRED || voiceChatEnabled;

  // ── Points ────────────────────────────────────────────────────────
  const loadPoints = async () => {
    if (!userId) return;
    setLoadingPoints(true);
    try {
      const res = await fetch(`${API_BASE}/points/${userId}`);
      const data = await res.json();
      if (data.success) setPoints(Number(data.data?.points ?? 0));
    } catch {}
    finally { setLoadingPoints(false); }
  };
    // Add this effect — scrolls to bottom whenever messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, loading]);

  useEffect(() => { loadPoints(); }, [userId]);
  useFocusEffect(React.useCallback(() => { 
    loadPoints(); 
    refreshFeatures(); // re-check voice flag every time screen opens
  }, [userId]));

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);
  useEffect(() => {
  const show = Keyboard.addListener('keyboardDidShow', () => {
    setKeyboardVisible(true);
  });

  const hide = Keyboard.addListener('keyboardDidHide', () => {
    setKeyboardVisible(false);
  });

  return () => {
    show.remove();
    hide.remove();
  };
}, []);

  // ── Open voice mode (points-gated) ───────────────────────────────
  const handleOpenVoiceMode = async () => {
    await loadPoints();
    await refreshFeatures(); //  get latest flag before checking

    const current = points ?? 0;
    const hasAccess = current >= PREMIUM_POINTS_REQUIRED || voiceChatEnabled;

    if (hasAccess) { setVoiceMode(true); return; }

    const remaining = Math.max(0, PREMIUM_POINTS_REQUIRED - current);
    Alert.alert(
      '🔒 Voice Mode Locked',
      `Unlock Voice Mode by collecting ${PREMIUM_POINTS_REQUIRED} points.\n\nYour points: ${current}\nNeed: ${remaining} more\n\nEarn points by walking in the Map.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go to Map', onPress: () => router.push('/(main)/map' as any) },
      ]
    );
  };

  // ── Speak voice response (chunked audio) ─────────────────────────
const stopSpeechRef = useRef(false);

const speakResponse = async (text: string, isFemale: boolean) => {
  stopSpeechRef.current = false; // reset on new speak
  setIsSpeakingResponse(true);
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      playThroughEarpieceAndroid: false,
    });
    const res = await fetch(`${API_BASE}/ai/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, isFemale }),
    });
    const data = await res.json();
    if (!data.success || !data.audioChunks?.length) throw new Error('TTS failed');

    const playChunks = async (chunks: string[], index: number) => {
      // ← check stop flag before each chunk
      if (stopSpeechRef.current || index >= chunks.length) {
        activeSoundRef.current = null;
        setIsSpeakingResponse(false);
        return;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${chunks[index]}` },
        { shouldPlay: true, volume: 1.0 }
      );
      activeSoundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          playChunks(chunks, index + 1);
        }
      });
    };
    await playChunks(data.audioChunks, 0);
  } catch (err) {
    console.error('Speech error:', err);
    setIsSpeakingResponse(false);
  }
};
  // ── Send text/voice message ───────────────────────────────────────
  const sendMessage = async (text?: string, isVoice = false): Promise<void> => {
    const messageText = (text ?? input).trim();
    if (!messageText || loading) return;

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    }]);
    setInput('');
    setLoading(true);

    try {
      const conversationHistory = messages
        .filter(m => m.id !== '0')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...conversationHistory, { role: 'user', content: messageText }],
        }),
      });
      const data = await response.json();

      if (data.success && data.message) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, aiMessage]);
        if (isVoice) await speakResponse(data.message, isFemaleAvatar);
      } else {
        throw new Error(data.error ?? 'No response');
      }
    } catch (err) {
      console.error('AI error:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I couldn't process your request. Please make sure your backend is running and try again!",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Landmark recognition (CV service) ────────────────────────────
  const recognizeLandmark = async (imageUri: string, modelType: 'outdoor' | 'artifact' = 'outdoor') => {
    setRecognizing(true);
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: '📸 What landmark is this?',
      image: imageUri,
      timestamp: new Date(),
    }]);

    try {
      const formData = new FormData();
      formData.append('image', { uri: imageUri, type: 'image/jpeg', name: 'landmark.jpg' } as any);
      formData.append('model_type', modelType);

      const response = await fetch(`${API_BASE}/recognition/analyze`, {
        method: 'POST',
        headers: { 'x-api-key': API_KEY, 'Content-Type': 'multipart/form-data' },
        body: formData,
      });
      const result = await response.json();

      let aiContent = '';
      if (result.success && result.recognized && result.attraction) {
        const a = result.attraction;
        const confidence = Math.round(result.confidence * 100);
        aiContent = `🏛️ I can see this is **${a.name}**! (${confidence}% confident)\n\n📍 **Location:** ${a.city}${a.district ? `, ${a.district}` : ''}\n\n📖 **About:** ${a.description}\n\n🕐 **Opening Hours:** ${a.open_hour != null && a.close_hour != null ? `${String(a.open_hour).padStart(2,'0')}:00 - ${String(a.close_hour).padStart(2,'0')}:00` : 'N/A'}\n\n💰 **Admission:** ${a.admission_egp ? `${a.admission_egp} EGP` : 'Free'}\n\n⭐ **Rating:** ${a.rating}/5\n\nWould you like me to add this to your itinerary or tell you more? 😊`;
      } else if (result.recognized && !result.attraction) {
        const confidence = Math.round(result.confidence * 100);
        aiContent = `🏛️ I think this is **${result.model_label?.replace(/_/g, ' ')}** (${confidence}% confident) but I don't have detailed info yet.\n\nWould you like me to search for more? 🔍`;
      } else {
        aiContent = "🤔 I couldn't clearly identify this landmark.\n\n📸 Make sure the landmark fills most of the frame\n☀️ Good lighting helps\n📐 Try a straight-on angle\n\nWould you like to try another photo? 😊";
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiContent,
        timestamp: new Date(),
      }]);
    } catch (err) {
      console.error('Recognition error:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "😕 I couldn't process the image right now. Please check your connection and try again!",
        timestamp: new Date(),
      }]);
    } finally {
      setRecognizing(false);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [4, 3], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) showModelTypeAlert(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your camera.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets[0]) showModelTypeAlert(result.assets[0].uri);
  };

  const showModelTypeAlert = (imageUri: string) => {
    Alert.alert(
      'What type of landmark?',
      'Is this an outdoor landmark or a museum artifact?',
      [
        { text: 'Outdoor Landmark', onPress: () => recognizeLandmark(imageUri, 'outdoor') },
        { text: 'Museum Artifact',  onPress: () => recognizeLandmark(imageUri, 'artifact') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const showImageOptions = () => {
    Alert.alert(
      'Identify a Landmark',
      'Take a photo or choose from your gallery',
      [
        { text: 'Take Photo',          onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickFromGallery },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ── Close voice mode ──────────────────────────────────────────────
const handleCloseVoice = async () => {
  try {
    stopSpeechRef.current = true; // ← cancel chunk chain
    if (activeSoundRef.current) {
      await activeSoundRef.current.stopAsync();
      await activeSoundRef.current.unloadAsync();
      activeSoundRef.current = null;
    }
  } catch {}
  setIsSpeakingResponse(false);
  setVoiceMode(false);
};
  const lastAIMessage = messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content ?? '';

  // ── Voice mode full-screen ────────────────────────────────────────
  if (voiceMode) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <VoiceModeOverlay
          onClose={handleCloseVoice}
          onTranscribed={(text) => sendMessage(text, true)}
          isProcessing={loading}
          isSpeaking={isSpeakingResponse}
          lastResponse={lastAIMessage}
          isFemale={isFemaleAvatar}
          onToggleGender={() => setIsFemaleAvatar(p => !p)}
        />
      </SafeAreaView>
    );
  }

  // ── Chat screen ───────────────────────────────────────────────────
return (
  <View style={{ flex: 1, backgroundColor: Theme.colors.background }}>

    {/* Background decoration — touches pass through */}
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <DesertTriangles />
    </View>

    <View style={{ flex: 1 }}>

 {/* ── HEADER ── */}
<SafeAreaView edges={['top']} style={{ backgroundColor: 'transparent' }}>
  <View style={styles.header}>
    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
      <Text style={styles.backIcon}>←</Text>
    </TouchableOpacity>

    <View style={styles.headerCenter}>
      {/* Glasses icon — left of title */}
      <TouchableOpacity
        onPress={() => setShowPremiumModal(true)}
        style={{ marginRight: 8 }}
      >
        <MaterialCommunityIcons name="glasses" size={24} color="#E67E22" />
      </TouchableOpacity>

      <Text style={styles.headerTitle}>{t('aiTitle')}</Text>
      <View style={styles.onlineBadge}>
        <View style={styles.onlineDot} />
        <Text style={styles.onlineText}>Online</Text>
      </View>
    </View>

    <TouchableOpacity
      style={styles.clearBtn}
      onPress={() =>
        setMessages([
          {
            id: '0',
            role: 'assistant',
            content: "👋 Hello again! How can I help you with your Egyptian adventure?",
            timestamp: new Date(),
          },
        ])
      }
    >
      <Text style={styles.clearBtnText}>Clear</Text>
    </TouchableOpacity>
  </View>
</SafeAreaView>

      {/* ── KEYBOARD AVOIDING — only wraps scroll + input ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >

        {/* ── CHAT AREA ── */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {(loading || recognizing) && (
            <View style={styles.bubbleRow}>
              <View style={styles.aiAvatar}>
                <Text style={styles.aiAvatarIcon}>🧳</Text>
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color="#E67E22" />
                <Text style={styles.typingText}>
                  {recognizing ? 'Identifying landmark...' : 'Tour Mate is thinking...'}
                </Text>
              </View>
            </View>
          )}

          {messages.length === 1 && (
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsTitle}>Quick questions:</Text>
              <View style={styles.suggestionsGrid}>
                {SUGGESTIONS.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionChip}
                    onPress={() =>
                      sendMessage(suggestion.replace(/^[\p{Emoji}\s]+/u, '').trim())
                    }
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── INPUT BAR ── */}
        <View style={[styles.inputBar, { marginBottom: keyboardVisible ? 0 : 90 }]}>
          <TouchableOpacity
            style={[styles.actionBtn, (recognizing || loading) && styles.actionBtnDisabled]}
            onPress={showImageOptions}
            disabled={recognizing || loading}
          >
            <MaterialCommunityIcons name="camera-outline" size={22} color={Theme.colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder={t('aiPlaceholder')}
            placeholderTextColor="#AAA"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[
              styles.voiceToggleBtn,
              !premiumUnlocked && styles.voiceToggleBtnLocked,
              loading && styles.actionBtnDisabled,
            ]}
            onPress={handleOpenVoiceMode}
            disabled={loading || recognizing}
          >
<View style={styles.voiceToggleIcon}>
  <Ionicons
    name={premiumUnlocked ? 'call' : 'lock-closed'}
    size={22}
    color={Theme.colors.primary}
  />
</View>

            {!premiumUnlocked && (
              <Text style={styles.voiceToggleSub}>
                {loadingPoints ? '...' : `${points ?? 0}/${PREMIUM_POINTS_REQUIRED}`}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.sendIcon}>→</Text>
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

    </View>

    <BottomTab active="Tour Mate" />
<Modal visible={showPremiumModal} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={styles.modalSheet}>

      <MaterialCommunityIcons name="glasses" size={48} color="#E67E22" />
      <Text style={styles.modalTitle}>Smart Glasses Mode</Text>
      <Text style={styles.modalDescription}>
        Experience Egypt like never before — wear your smart glasses and let TourMate guide you hands-free.
        Get real-time info on landmarks, restaurants, and hidden gems right in your field of view.
      </Text>

      <View style={styles.modalPremiumBox}>
        <Text style={styles.modalPremiumLabel}>✨ Premium Feature</Text>
        <Text style={styles.modalPremiumText}>
          Pair your wearable smart glasses with TourMate to enjoy a fully immersive,
          seamless travel experience — no phone needed while exploring.
        </Text>
        <Text style={styles.modalPointsText}>
          Your points: {points ?? 0}/{PREMIUM_POINTS_REQUIRED}
        </Text>
      </View>

      <TouchableOpacity style={styles.modalBtn} onPress={() => setShowPremiumModal(false)}>
        <Text style={styles.modalBtnText}>Got it</Text>
      </TouchableOpacity>

    </View>
  </View>
</Modal>
  </View>
);
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E2C8',
  },

  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
headerCenter: {
  flexDirection: 'column',
  alignItems: 'center',
},
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#2C1810',
  },

  backIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: Theme.colors.hero,
  },


  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },

  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2ECC71',
  },

  onlineText: {
    fontSize: 11,
    color: '#2ECC71',
    fontWeight: '600',
  },

  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFF',
  },

  clearBtnText: {
    fontSize: 13,
    color: Theme.colors.muted,
    fontWeight: '600',
  },
// Smart Glasses Modal
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(26,10,0,0.55)',
  justifyContent: 'center',
  alignItems: 'center',
  padding: 24,
},

modalSheet: {
  backgroundColor: Theme.colors.card,
  borderRadius: 24,
  padding: 24,
  alignItems: 'center',
  width: '100%',
},

modalTitle: {
  fontSize: 20,
  fontWeight: '800',
  color: Theme.colors.hero,
  marginTop: 12,
},

modalDescription: {
  fontSize: 14,
  color: Theme.colors.muted,
  textAlign: 'center',
  marginTop: 8,
  lineHeight: 20,
},

modalPremiumBox: {
  backgroundColor: Theme.colors.background,
  borderRadius: 16,
  padding: 16,
  marginTop: 16,
  width: '100%',
  borderWidth: 1,
  borderColor: 'rgba(245,217,139,0.45)',
},

modalPremiumLabel: {
  fontSize: 13,
  fontWeight: '700',
  color: Theme.colors.primary,
  marginBottom: 8,
},

modalPremiumText: {
  fontSize: 12,
  color: Theme.colors.text,
  lineHeight: 18,
},

modalPointsText: {
  fontSize: 13,
  fontWeight: '700',
  color: Theme.colors.hero,
  marginTop: 8,
},

modalBtn: {
  backgroundColor: Theme.colors.primary,
  borderRadius: 30,
  paddingVertical: 14,
  paddingHorizontal: 32,
  marginTop: 20,
},

modalBtnText: {
  color: Theme.colors.card,
  fontWeight: '700',
  fontSize: 15,
},

// Make sure these styles are set:
messagesContainer: {
  flex: 1,        // ← must have this
},
messagesContent: {
  flexGrow: 1,    // ← must have this
  paddingHorizontal: 16,
  paddingTop: 10,
},

  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    gap: 8,
  },

  bubbleRowUser: {
    flexDirection: 'row-reverse',
  },

  aiAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },

  aiAvatarIcon: {
    fontSize: 18,
  },

  bubble: {
    borderRadius: 20,
    padding: 12,
    elevation: 1,
  },

  bubbleAI: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4,
  },

  bubbleUser: {
    backgroundColor: Theme.colors.primary,
    borderBottomRightRadius: 4,
  },

  bubbleText: {
    fontSize: 14,
    color: Theme.colors.hero,
    lineHeight: 20,
  },

  bubbleTextUser: {
    color: '#FFF',
  },

  bubbleTime: {
    fontSize: 10,
    color: Theme.colors.muted,
    marginTop: 4,
    textAlign: 'right',
  },

  bubbleTimeUser: {
    color: 'rgba(255,255,255,0.7)',
  },

  messageImage: {
    width: '65%',
    height: 180,
    borderRadius: 16,
    marginBottom: 4,
    borderBottomLeftRadius: 4,
  },

  messageImageUser: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 4,
  },

  speakBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#F3E0C7',
  },

  speakBtnActive: {
    backgroundColor: Theme.colors.primary + '15',
    borderColor: Theme.colors.primary,
  },

  speakBtnPaused: {
    backgroundColor: '#FFF7ED',
    borderColor: Theme.colors.primary,
  },

  speakBtnText: {
    fontSize: 11,
    color: Theme.colors.primary,
    fontWeight: '700',
  },

  speakBtnTextActive: {
    color: Theme.colors.primary,
  },

  speakBtnTextPaused: {
    color: Theme.colors.hero,
  },

  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    padding: 12,
  },

  typingText: {
    fontSize: 13,
    color: Theme.colors.muted,
  },

  suggestionsContainer: {
    marginTop: 8,
  },

  suggestionsTitle: {
    fontSize: 13,
    color: Theme.colors.muted,
    fontWeight: '600',
    marginBottom: 10,
  },

  suggestionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  suggestionChip: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },

  suggestionText: {
    fontSize: 13,
    color: Theme.colors.hero,
    fontWeight: '500',
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    gap: 10,
  },

  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },

  actionBtnDisabled: {
    opacity: 0.5,
  },

  voiceToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
  },

voiceToggleIcon: {
  alignItems: 'center',
  justifyContent: 'center',
},
  voiceToggleBtnLocked: {
    backgroundColor: '#F5F5F5',
  },

  voiceToggleSub: {
    position: 'absolute',
    bottom: -14,
    fontSize: 10,
    color: Theme.colors.muted,
    fontWeight: '700',
  },

  input: {
    flex: 1,
    backgroundColor: '#F7F7F7',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: Theme.colors.hero,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },

  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },

  sendBtnDisabled: {
    backgroundColor: '#DDD',
    shadowOpacity: 0,
  },

  sendIcon: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },

});