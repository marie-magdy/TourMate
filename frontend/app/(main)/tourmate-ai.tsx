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
import ProUpgradeModal from '../../components/ProUpgradeModal';
import { Keyboard } from 'react-native';


import DesertTriangles from '../../components/DesertTriangles';
import { Theme } from '../../constants/theme';

const BOTTOM_TAB_HEIGHT = 60; // adjust to match your BottomTab height

const { width } = Dimensions.get('window');
const API_KEY  = process.env.EXPO_PUBLIC_API_KEY ?? '';

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
  const hairColor  = isFemale ? '#8B4513' : '#501a04';
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
        {/* Brim - wider and higher */}
        <Ellipse cx="80" cy="44" rx="62" ry="11" fill="#8B6914" />

        {/* Hat body */}
        <Rect x="36" y="18" width="88" height="28" rx="6" fill="#C49A22" />

        {/* Hat band */}
        <Rect x="36" y="40" width="88" height="7" fill="#7B5200" />

        {/* Hat highlight */}
        <Path d="M42 22 Q60 19 76 22" stroke="rgba(255,255,255,0.3)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <Rect x="66" y="148" width="28" height="26" rx="8" fill={skinColor} />
        <Path d="M10 198 Q30 162 66 154 L94 154 Q120 162 150 198 Z" fill={shirtColor} />
        <Path d="M72 154 L80 172 L88 154" fill="rgba(255,255,255,0.3)" />
        <Ellipse cx="80" cy="100" rx="50" ry="55" fill={skinColor} />
        {/* //hair  */}
        {isFemale && (
          <>
            <Path d="M30 90 Q20 130 28 160 Q40 145 42 118" fill={hairColor} />
            <Path d="M130 90 Q140 130 132 160 Q120 145 118 118" fill={hairColor} />
          </>
        )}
        {isFemale
          ? <Path d="M30 85 Q32 48 80 46 Q128 48 130 85 Q115 60 80 58 Q45 60 30 85 Z" fill={hairColor} />
          : <Path d="M30 88 Q32 52 80 45 Q128 52 130 88 Q115 66 80 64 Q45 66 30 85 Z" fill={hairColor} />
        }
        {/* ears */}
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
  userId: number;
  onClose: () => void;
  onTranscribed: (text: string) => void;
  isProcessing: boolean;
  isSpeaking: boolean;
  lastResponse: string;
  isFemale: boolean;
  onToggleGender: () => void;
}> = ({ userId, onClose, onTranscribed, isProcessing, isSpeaking, lastResponse, isFemale, onToggleGender }) => {
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
        body: JSON.stringify({ audio: base64, mimeType: 'audio/m4a', user_id: userId }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        setStatus(`You said: "${data.text}"`);
        setRecordingDone(true);
        onTranscribed(data.text);
      } else if (data.code === 'PRO_REQUIRED') {
        setStatus('Voice requires TourMate Pro');
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
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const router = useRouter();
  const { t, userId, features, refreshFeatures } = useApp();
  const scrollRef = useRef<ScrollView>(null);

  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showProUpgrade, setShowProUpgrade] = useState(false);

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
  const activeSoundRef = useRef<any>(null);

  const promptUpgrade = (featureLabel: string) => {
    Alert.alert(
      '🔒 TourMate Pro',
      `${featureLabel} is included with TourMate Pro. Upgrade in Settings or tap Upgrade below.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upgrade', onPress: () => setShowProUpgrade(true) },
      ],
    );
  };
    // Add this effect — scrolls to bottom whenever messages change
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, loading]);

  useFocusEffect(React.useCallback(() => {
    refreshFeatures();
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
    const latest = await refreshFeatures();
    if (latest.voice) {
      setVoiceMode(true);
      return;
    }
    promptUpgrade('Voice chat');
  };

  // ── Speak voice response (chunked audio) ─────────────────────────
  const speakResponse = async (text: string, isFemale: boolean) => {
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
        body: JSON.stringify({ text, isFemale, user_id: userId }),
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

    const latest = await refreshFeatures();
    if (latest.chat_remaining <= 0) {
      Alert.alert(
        'Daily limit reached',
        `Free accounts get ${latest.chat_limit} AI messages per day. Upgrade to TourMate Pro for unlimited chat.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => setShowProUpgrade(true) },
        ],
      );
      return;
    }

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
          user_id: userId,
          messages: [...conversationHistory, { role: 'user', content: messageText }],
        }),
      });
      const data = await response.json();

      if (data.code === 'CHAT_LIMIT') {
        await refreshFeatures();
        Alert.alert('Daily limit reached', data.error ?? 'Upgrade to TourMate Pro for unlimited chat.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => setShowProUpgrade(true) },
        ]);
        return;
      }

      if (data.success && data.message) {
        await refreshFeatures();
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
    const latest = await refreshFeatures();
    if (!latest.cv) {
      promptUpgrade('Landmark photo recognition');
      return;
    }

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
      formData.append('user_id', String(userId));

      const response = await fetch(`${API_BASE}/recognition/analyze`, {
        method: 'POST',
        headers: { 'x-api-key': API_KEY, 'Content-Type': 'multipart/form-data' },
        body: formData,
      });
      const result = await response.json();

      if (result.code === 'PRO_REQUIRED') {
        promptUpgrade('Landmark photo recognition');
        return;
      }

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

  const showImageOptions = async () => {
    const latest = await refreshFeatures();
    if (!latest.cv) {
      promptUpgrade('Landmark photo recognition');
      return;
    }
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
    try {                                          // ← wrap in try/catch
      if (activeSoundRef.current) {
        await activeSoundRef.current.stopAsync();
        await activeSoundRef.current.unloadAsync();
        activeSoundRef.current = null;
      }
    } catch {}                                     // ← swallow any error silently
    setIsSpeakingResponse(false);
    setVoiceMode(false);
  };
  const lastAIMessage = messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content ?? '';

  // ── Voice mode full-screen ────────────────────────────────────────
  if (voiceMode) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <VoiceModeOverlay
          userId={userId}
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
        onPress={() => {
          if (features.ar) setShowPremiumModal(true);
          else promptUpgrade('Smart glasses / AR mode');
        }}
        style={{ marginRight: 8 }}
      >
        <MaterialCommunityIcons
          name="glasses"
          size={24}
          color={features.ar ? '#E67E22' : '#BBB'}
        />
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
            <MaterialCommunityIcons name="camera-outline" size={22} color="#E67E22" />
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
              !features.voice && styles.voiceToggleBtnLocked,
              loading && styles.actionBtnDisabled,
            ]}
            onPress={handleOpenVoiceMode}
            disabled={loading || recognizing}
          >
            <Text style={styles.voiceToggleIcon}>
              {features.voice ? '🎤' : '🔒'}
            </Text>
            {!features.is_pro && (
              <Text style={styles.voiceToggleSub}>
                {features.chat_remaining}/{features.chat_limit}
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
        <Text style={styles.modalPremiumLabel}>✨ Pro — AR mode active</Text>
        <Text style={styles.modalPremiumText}>
          Pair your wearable smart glasses with TourMate to enjoy a fully immersive,
          hands-free travel experience while exploring Egypt.
        </Text>
      </View>

      <TouchableOpacity style={styles.modalBtn} onPress={() => setShowPremiumModal(false)}>
        <Text style={styles.modalBtnText}>Got it</Text>
      </TouchableOpacity>

    </View>
  </View>
</Modal>
    <ProUpgradeModal
      visible={showProUpgrade}
      userId={userId}
      onClose={() => setShowProUpgrade(false)}
      onUpgraded={() => refreshFeatures(userId)}
    />
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
    fontSize: 20,
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

  voiceOverlay: {
    flex: 1,
    backgroundColor: Theme.colors.hero,
  },

  voiceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },

  voiceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },

  voiceCloseBtn: {
    backgroundColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },

  voiceCloseBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },

  voiceStatusArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },

  voiceStatusText: {
    fontSize: 15,
    color: '#CCC',
    textAlign: 'center',
    lineHeight: 24,
  },

  voiceMicContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    height: 130,
  },

  voiceMicPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Theme.colors.primary + '20',
  },

  voiceMicBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },

  voiceMicBtnActive: {
    backgroundColor: '#E74C3C',
  },

  voiceMicIcon: {
    fontSize: 34,
  },

  voiceHint: {
    textAlign: 'center',
    color: Theme.colors.muted,
    fontSize: 13,
    marginBottom: 8,
  },

  voiceHeadphonesTip: {
    textAlign: 'center',
    color: Theme.colors.muted,
    fontSize: 12,
    marginBottom: 48,
  },

  genderSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },

  genderSwitchText: {
    color: Theme.colors.hero,
    fontSize: 14,
    fontWeight: '700',
  },

  genderSwitchArrow: {
    color: Theme.colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
});