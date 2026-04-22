// app/(main)/tourmate-ai.tsx
import React, { useState, useRef, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, Dimensions, Image, Alert,
  Animated,
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

const { width } = Dimensions.get('window');
const API_KEY  = process.env.EXPO_PUBLIC_API_KEY ?? '';
const PREMIUM_POINTS_REQUIRED = 500;

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

// ── Animated TourMate Avatar ──────────────────────────────────────────
const TourMateAvatar: React.FC<{
  isSpeaking: boolean;
  isThinking: boolean;
  isListening: boolean;
  isFemale: boolean;
}> = ({ isSpeaking, isThinking, isListening, isFemale }) => {
  const blinkAnim = useRef(new Animated.Value(1)).current;
  const mouthAnim = useRef(new Animated.Value(0)).current;
  const bobAnim   = useRef(new Animated.Value(0)).current;
  const browAnim  = useRef(new Animated.Value(0)).current;

  const skinColor  = isFemale ? '#FADADD' : '#F5CBA7';
  const skinDark   = isFemale ? '#F0B8BE' : '#E8A87C';
  const hairColor  = isFemale ? '#8B4513' : '#1C1C1C';
  const shirtColor = isFemale ? '#C0392B' : '#2471A3';

  // Blink every 3.5s
  useEffect(() => {
    const t = setInterval(() => {
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.05, duration: 80, useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1,    duration: 80, useNativeDriver: true }),
      ]).start();
    }, 3500);
    return () => clearInterval(t);
  }, []);

  // State-driven animations
  useEffect(() => {
    if (isSpeaking) {
      mouthAnim.setValue(0.5);
      const m = Animated.loop(Animated.sequence([
        Animated.timing(mouthAnim, { toValue: 1,   duration: 150, useNativeDriver: false }),
        Animated.timing(mouthAnim, { toValue: 0.2, duration: 150, useNativeDriver: false }),
      ]));
      const b = Animated.loop(Animated.sequence([
        Animated.timing(bobAnim, { toValue: -3, duration: 350, useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue:  3, duration: 350, useNativeDriver: true }),
      ]));
      m.start(); b.start();
      return () => { m.stop(); b.stop(); mouthAnim.setValue(0); bobAnim.setValue(0); };
    }
    if (isThinking) {
      const br = Animated.loop(Animated.sequence([
        Animated.timing(browAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(browAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]));
      br.start();
      return () => { br.stop(); browAnim.setValue(0); };
    }
    if (isListening) {
      const b = Animated.loop(Animated.sequence([
        Animated.timing(bobAnim, { toValue: -2, duration: 400, useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue:  2, duration: 400, useNativeDriver: true }),
      ]));
      b.start();
      return () => { b.stop(); bobAnim.setValue(0); };
    }
    const idle = Animated.loop(Animated.sequence([
      Animated.timing(bobAnim, { toValue: -1.5, duration: 2000, useNativeDriver: true }),
      Animated.timing(bobAnim, { toValue:  1.5, duration: 2000, useNativeDriver: true }),
    ]));
    idle.start();
    return () => { idle.stop(); bobAnim.setValue(0); };
  }, [isSpeaking, isThinking, isListening]);

  const mouthH  = mouthAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 14] });
  const browOff = browAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  return (
    <Animated.View style={{ transform: [{ translateY: bobAnim }], alignItems: 'center' }}>
      <Svg width={160} height={200} viewBox="0 0 160 200">
        <Ellipse cx="80" cy="30" rx="58" ry="10" fill="#8B6914" />
        <Rect x="38" y="4" width="84" height="28" rx="6" fill="#C49A22" />
        <Rect x="38" y="24" width="84" height="7" fill="#7B5200" />
        <Path d="M44 8 Q60 5 76 8" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <Rect x="66" y="148" width="28" height="26" rx="8" fill={skinColor} />
        <Path d="M10 198 Q30 162 66 154 L94 154 Q120 162 150 198 Z" fill={shirtColor} />
        <Path d="M72 154 L80 172 L88 154" fill="rgba(255,255,255,0.3)" />
        <Ellipse cx="80" cy="100" rx="50" ry="55" fill={skinColor} />
        {isFemale && (
          <>
            <Path d="M30 90 Q20 130 28 160 Q40 145 42 118" fill={hairColor} />
            <Path d="M130 90 Q140 130 132 160 Q120 145 118 118" fill={hairColor} />
          </>
        )}
        {isFemale
          ? <Path d="M30 85 Q32 38 80 34 Q128 38 130 85 Q115 55 80 52 Q45 55 30 85 Z" fill={hairColor} />
          : <Path d="M30 88 Q32 42 80 40 Q128 42 130 88 Q115 62 80 60 Q45 62 30 88 Z" fill={hairColor} />
        }
        <Ellipse cx="30" cy="104" rx="8" ry="10" fill={skinDark} />
        <Ellipse cx="130" cy="104" rx="8" ry="10" fill={skinDark} />
        <Ellipse cx="60" cy="98" rx="12" ry="11" fill="#FFF" />
        <Ellipse cx="100" cy="98" rx="12" ry="11" fill="#FFF" />
        <Animated.View style={{ position: 'absolute', left: 44, top: 83, transform: [{ scaleY: blinkAnim }] }}>
          <Svg width="20" height="20">
            <Circle cx="10" cy="10" r="8" fill={isFemale ? '#6B3A2A' : '#1A5276'} />
            <Circle cx="10" cy="10" r="4" fill="#0A0A0A" />
            <Circle cx="10" cy="7" r="2.5" fill="#FFF" opacity="0.9" />
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', left: 84, top: 83, transform: [{ scaleY: blinkAnim }] }}>
          <Svg width="20" height="20">
            <Circle cx="10" cy="10" r="8" fill={isFemale ? '#6B3A2A' : '#1A5276'} />
            <Circle cx="10" cy="10" r="4" fill="#0A0A0A" />
            <Circle cx="10" cy="7" r="2.5" fill="#FFF" opacity="0.9" />
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', left: 44, top: 70, transform: [{ translateY: browOff }] }}>
          <Svg width="32" height="10">
            {isFemale
              ? <Path d="M2 8 Q16 1 30 5" stroke={hairColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
              : <Path d="M2 7 Q16 2 30 5" stroke={hairColor} strokeWidth="3.5" strokeLinecap="round" fill="none" />
            }
          </Svg>
        </Animated.View>
        <Animated.View style={{ position: 'absolute', left: 84, top: 70, transform: [{ translateY: browOff }] }}>
          <Svg width="32" height="10">
            {isFemale
              ? <Path d="M2 5 Q16 1 30 8" stroke={hairColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
              : <Path d="M2 5 Q16 2 30 7" stroke={hairColor} strokeWidth="3.5" strokeLinecap="round" fill="none" />
            }
          </Svg>
        </Animated.View>
        {isFemale && (
          <>
            <Path d="M48 86 L46 82 M52 84 L51 80 M56 84 L56 80" stroke="#1C1C1C" strokeWidth="1.5" strokeLinecap="round" />
            <Path d="M88 86 L86 82 M92 84 L91 80 M96 84 L96 80 M100 86 L102 82" stroke="#1C1C1C" strokeWidth="1.5" strokeLinecap="round" />
          </>
        )}
        <Path d="M76 108 Q74 116 70 120 Q74 123 80 122 Q86 123 90 120 Q86 116 84 108" fill={skinDark} opacity="0.45" />
        <Animated.View style={{ position: 'absolute', left: 58, top: 126, overflow: 'hidden' }}>
          <Animated.View style={{ height: mouthH, width: 44, overflow: 'hidden' }}>
            <Svg width="44" height="16">
              <Path d="M2 2 Q22 16 42 2" fill="#B03A2E" stroke="#B03A2E" strokeWidth="1" />
              <Path d="M4 4 Q22 13 40 4 Q22 10 4 4 Z" fill={isFemale ? '#E8A0A0' : '#E74C3C'} opacity="0.6" />
            </Svg>
          </Animated.View>
        </Animated.View>
        {isFemale && (
          <Path d="M64 128 Q72 124 80 126 Q88 124 96 128" stroke="#C0392B" strokeWidth="1" fill="none" />
        )}
      </Svg>
    </Animated.View>
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
    <View style={styles.voiceOverlay}>
      <View style={styles.voiceHeader}>
        <Text style={styles.voiceTitle}>🧳 TourMate Voice</Text>
        <TouchableOpacity style={styles.voiceCloseBtn} onPress={onClose}>
          <Text style={styles.voiceCloseBtnText}>✕ Exit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.voiceStatusArea}>
        <TourMateAvatar
          isSpeaking={isSpeaking}
          isThinking={isProcessing}
          isListening={isRecording}
          isFemale={isFemale}
        />
        <TouchableOpacity onPress={onToggleGender} style={styles.genderSwitch}>
          <Text style={styles.genderSwitchText}>{isFemale ? '👩 Female' : '👨 Male'}</Text>
          <Text style={styles.genderSwitchArrow}>⇄</Text>
        </TouchableOpacity>
        <Text style={styles.voiceStatusText}>{getStatusText()}</Text>
        {(isProcessing || isSpeaking) && (
          <ActivityIndicator size="small" color="#E67E22" style={{ marginTop: 16 }} />
        )}
      </View>

      <View style={styles.voiceMicContainer}>
        <Animated.View style={[styles.voiceMicPulse, { transform: [{ scale: pulseAnim }] }]} />
        <TouchableOpacity
          style={[styles.voiceMicBtn, isRecording && styles.voiceMicBtnActive]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={isProcessing || isSpeaking}
          activeOpacity={0.8}
        >
          <Text style={styles.voiceMicIcon}>{isRecording ? '⏹' : '🎤'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.voiceHint}>
        {isRecording ? 'Tap to stop recording'
          : isProcessing || isSpeaking ? 'Please wait...'
          : 'Tap mic to speak with TourMate'}
      </Text>
      <Text style={styles.voiceHeadphonesTip}>🎧 For best audio quality, use headphones</Text>
    </View>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────
export default function TourMateAIScreen() {
  const router = useRouter();
  const { t, userId } = useApp();
  const scrollRef = useRef<ScrollView>(null);

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

  const premiumUnlocked = (points ?? 0) >= PREMIUM_POINTS_REQUIRED;

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

  useEffect(() => { loadPoints(); }, [userId]);
  useFocusEffect(React.useCallback(() => { loadPoints(); }, [userId]));
  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ── Open voice mode (points-gated) ───────────────────────────────
  const handleOpenVoiceMode = async () => {
    await loadPoints();
    const current = points ?? 0;
    if (current >= PREMIUM_POINTS_REQUIRED) { setVoiceMode(true); return; }
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
  const speakResponse = async (text: string) => {
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
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!data.success || !data.audioChunks?.length) throw new Error('TTS failed');

      const playChunks = async (chunks: string[], index: number) => {
        if (index >= chunks.length) { activeSoundRef.current = null; setIsSpeakingResponse(false); return; }
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
        if (isVoice) await speakResponse(data.message);
      } else {
        throw new Error(data.error ?? 'No response');
      }
    } catch (err) {
      console.error('AI error:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I couldn't process your request. Please make sure your backend is running and try again! 🙏",
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
        aiContent = `🏛️ I can see this is **${a.name}**! (${confidence}% confident)\n\n📍 **Location:** ${a.city}${a.district ? `, ${a.district}` : ''}\n\n📖 **About:** ${a.description}\n\n🕐 **Opening Hours:** ${a.opening_hours ?? 'N/A'}\n\n💰 **Admission:** ${a.admission_egp ? `${a.admission_egp} EGP` : 'Free'}\n\n⭐ **Rating:** ${a.rating}/5\n\nWould you like me to add this to your itinerary or tell you more? 😊`;
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
    if (activeSoundRef.current) {
      try { await activeSoundRef.current.stopAsync(); await activeSoundRef.current.unloadAsync(); } catch {}
      activeSoundRef.current = null;
    }
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{t('aiTitle')}</Text>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Online</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={() => setMessages([{
            id: '0', role: 'assistant',
            content: "👋 Hello again! How can I help you with your Egyptian adventure?",
            timestamp: new Date(),
          }])}
        >
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(message => <MessageBubble key={message.id} message={message} />)}

          {(loading || recognizing) && (
            <View style={styles.bubbleRow}>
              <View style={styles.aiAvatar}><Text style={styles.aiAvatarIcon}>🧳</Text></View>
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
                    onPress={() => sendMessage(suggestion.replace(/^[\p{Emoji}\s]+/u, '').trim())}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input bar: camera | text input | mic (gated) | send */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={[styles.actionBtn, (recognizing || loading) && styles.actionBtnDisabled]}
            onPress={showImageOptions}
            disabled={recognizing || loading}
          >
            <MaterialCommunityIcons name="camera-outline" size={22} color="#E67E22" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            {...{ placeholder: t('aiPlaceholder') }}
            placeholderTextColor="#AAA"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[styles.voiceToggleBtn, !premiumUnlocked && styles.voiceToggleBtnLocked, loading && styles.actionBtnDisabled]}
            onPress={handleOpenVoiceMode}
            disabled={loading || recognizing}
            activeOpacity={0.8}
          >
            <Text style={styles.voiceToggleIcon}>{premiumUnlocked ? '🎤' : '🔒'}</Text>
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
            {loading
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Text style={styles.sendIcon}>→</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea:             { flex: 1, backgroundColor: '#F5F5F5' },
  flex:                 { flex: 1 },
  header:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn:              { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backIcon:             { fontSize: 22, fontWeight: '700', color: '#333' },
  headerCenter:         { alignItems: 'center' },
  headerTitle:          { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  onlineBadge:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  onlineDot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: '#27AE60' },
  onlineText:           { fontSize: 11, color: '#27AE60', fontWeight: '600' },
  clearBtn:             { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F5F5F5' },
  clearBtnText:         { fontSize: 13, color: '#999', fontWeight: '600' },
  messagesContainer:    { flex: 1 },
  messagesContent:      { padding: 16, paddingBottom: 20 },
  bubbleRow:            { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
  bubbleRowUser:        { flexDirection: 'row-reverse' },
  aiAvatar:             { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  aiAvatarIcon:         { fontSize: 18 },
  bubble:               { borderRadius: 20, padding: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  bubbleAI:             { backgroundColor: '#FFF', borderBottomLeftRadius: 4 },
  bubbleUser:           { backgroundColor: '#E67E22', borderBottomRightRadius: 4 },
  bubbleText:           { fontSize: 14, color: '#1A1A1A', lineHeight: 20 },
  bubbleTextUser:       { color: '#FFF' },
  bubbleTime:           { fontSize: 10, color: '#BBB', marginTop: 4, textAlign: 'right' },
  bubbleTimeUser:       { color: 'rgba(255,255,255,0.7)' },
  messageImage:         { width: width * 0.65, height: 180, borderRadius: 16, marginBottom: 4, borderBottomLeftRadius: 4 },
  messageImageUser:     { borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  speakBtn:             { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#FDDCB5' },
  speakBtnActive:       { backgroundColor: '#FFE5E5', borderColor: '#FFAAAA' },
  speakBtnPaused:       { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
  speakBtnText:         { fontSize: 11, color: '#E67E22', fontWeight: '700' },
  speakBtnTextActive:   { color: '#E74C3C' },
  speakBtnTextPaused:   { color: '#27AE60' },
  typingBubble:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 20, borderBottomLeftRadius: 4, padding: 12 },
  typingText:           { fontSize: 13, color: '#999' },
  suggestionsContainer: { marginTop: 8 },
  suggestionsTitle:     { fontSize: 13, color: '#999', fontWeight: '600', marginBottom: 10 },
  suggestionsGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip:       { backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#EEE', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  suggestionText:       { fontSize: 13, color: '#555', fontWeight: '500' },

  // Input bar
  inputBar:             { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 28, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F0F0F0', gap: 10 },
  actionBtn:            { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FDDCB5' },
  actionBtnDisabled:    { opacity: 0.5 },
  voiceToggleBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FDDCB5' },
  voiceToggleIcon:      { fontSize: 20 },
  voiceToggleBtnLocked: { backgroundColor: '#F5F5F5', borderColor: '#EEE' },
  voiceToggleSub:       { position: 'absolute', bottom: -14, fontSize: 10, color: '#999', fontWeight: '700' },
  input:                { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#333', maxHeight: 100, borderWidth: 1, borderColor: '#EEE' },
  sendBtn:              { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E67E22', justifyContent: 'center', alignItems: 'center', shadowColor: '#E67E22', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  sendBtnDisabled:      { backgroundColor: '#DDD', shadowOpacity: 0 },
  sendIcon:             { color: '#FFF', fontSize: 18, fontWeight: '700' },

  // Voice mode overlay (full screen dark)
  voiceOverlay:         { flex: 1, backgroundColor: '#1A1A1A' },
  voiceHeader:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  voiceTitle:           { fontSize: 18, fontWeight: '700', color: '#FFF' },
  voiceCloseBtn:        { backgroundColor: '#333', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  voiceCloseBtnText:    { color: '#FFF', fontSize: 13, fontWeight: '600' },
  voiceStatusArea:      { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  voiceStatusText:      { fontSize: 15, color: '#CCC', textAlign: 'center', lineHeight: 24 },
  voiceMicContainer:    { alignItems: 'center', justifyContent: 'center', marginBottom: 24, height: 130 },
  voiceMicPulse:        { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(230,126,34,0.15)' },
  voiceMicBtn:          { width: 84, height: 84, borderRadius: 42, backgroundColor: '#E67E22', justifyContent: 'center', alignItems: 'center', shadowColor: '#E67E22', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  voiceMicBtnActive:    { backgroundColor: '#E74C3C', shadowColor: '#E74C3C' },
  voiceMicIcon:         { fontSize: 34 },
  voiceHint:            { textAlign: 'center', color: '#555', fontSize: 13, marginBottom: 8 },
  voiceHeadphonesTip:   { textAlign: 'center', color: '#444', fontSize: 12, marginBottom: 48 },
  genderSwitch:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, marginTop: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  genderSwitchText:     { color: '#FFF', fontSize: 14, fontWeight: '700' },
  genderSwitchArrow:    { color: '#E67E22', fontSize: 16, fontWeight: '900' },
});