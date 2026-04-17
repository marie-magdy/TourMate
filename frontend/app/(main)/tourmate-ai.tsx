// app/(main)/tourmate-ai.tsx
import React, { useState, useRef, useEffect } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, SafeAreaView,
  KeyboardAvoidingView, Platform, Dimensions, Image, Alert,
  Animated, Modal
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '../../constants/AppContext';

const { width } = Dimensions.get('window');
const API_BASE = `http://${process.env.EXPO_PUBLIC_API_URL}:3000/api`;
const API_KEY  = process.env.EXPO_PUBLIC_API_KEY ?? '';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  image?: string; // base64 or uri for image messages
}

const SUGGESTIONS = [
  'Tell me about the Pyramids',
  'Plan 3 days in Cairo',
  'Best diving in Hurghada',
  'Must-try Egyptian food',
  'Budget tips for Egypt',
  'Best time to visit Luxor',
  'What to pack for Sharm?',
  'Safety tips for tourists',
];

// ── Message Bubble ─────────────────────────────────────────────────
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.role === 'user';
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const soundRef = useRef<any>(null);

  const handleSpeak = async () => {
    if (paused && soundRef.current) {
      await soundRef.current.playAsync();
      setSpeaking(true);
      setPaused(false);
      return;
    }
    if (speaking && soundRef.current) {
      await soundRef.current.pauseAsync();
      setSpeaking(false);
      setPaused(true);
      return;
    }
    setLoadingAudio(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const res = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'TourMate AI',
          description: message.content,
          language: 'en',
          raw_text: message.content,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error('TTS failed');
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${data.audio}` },
        { shouldPlay: true },
        (status: any) => {
          if (status.didJustFinish || (!status.isLoaded && status.error)) {
            setSpeaking(false);
            setPaused(false);
            soundRef.current = null;
          }
        }
      );
      soundRef.current = sound;
      setSpeaking(true);
      setPaused(false);
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
          <MaterialCommunityIcons name="robot-outline" size={20} color="#E67E22" />
        </View>
      )}
      <View style={{ maxWidth: width * 0.72 }}>
        {/* Show image if message has one */}
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
              : <>
                  <MaterialCommunityIcons
                    name={speaking ? 'pause' : paused ? 'play' : 'volume-high'}
                    size={13}
                    color={speaking ? '#E74C3C' : paused ? '#27AE60' : '#E67E22'}
                  />
                  <Text style={[styles.speakBtnText, speaking && styles.speakBtnTextActive, paused && styles.speakBtnTextPaused]}>
                    {speaking ? 'Pause' : paused ? 'Resume' : 'Listen'}
                  </Text>
                </>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ── Main Screen ─────────────────────────────────────────────────────
export default function TourMateAIScreen() {
  const router = useRouter();
  const { t } = useApp();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: "👋 Hello! I'm Tour Mate, your personal Egyptian travel assistant!\n\nI can help you with:\n🏛️ Historical places & monuments\n🗺️ Trip planning & itineraries\n💰 Budget advice & cost estimates\n🍽️ Local food recommendations\n🎒 Packing tips by city & season\n⚠️ Safety tips for tourists\n📸 Identify landmarks from photos!\n\nWhat would you like to know about Egypt?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recognizing, setRecognizing] = useState(false);

  // ── Voice mode state ───────────────────────────────────────────
  const [voiceModeVisible, setVoiceModeVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeakingVoice, setIsSpeakingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceAiResponse, setVoiceAiResponse] = useState('');
  const [voiceStatus, setVoiceStatus] = useState('Tap microphone to speak');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const voiceSoundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // ── Send text message ──────────────────────────────────────────
  const sendMessage = async (text?: string): Promise<void> => {
    const messageText = (text ?? input).trim();
    if (!messageText || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
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
          messages: [
            ...conversationHistory,
            { role: 'user', content: messageText },
          ],
        }),
      });

      const data = await response.json();

      if (data.success && data.message) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        }]);
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

  // ── Recognize landmark from image ──────────────────────────────
  const recognizeLandmark = async (imageUri: string, modelType: 'outdoor' | 'artifact' = 'outdoor') => {
    setRecognizing(true);

    // Add user message showing the image
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: '📸 What landmark is this?',
      image: imageUri,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Create form data with image
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'landmark.jpg',
      } as any);
      formData.append('model_type', modelType);

      const response = await fetch(`${API_BASE}/recognition/analyze`, {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success && result.recognized && result.attraction) {
        const a = result.attraction;
        const confidence = Math.round(result.confidence * 100);

        // Format a nice response with attraction info
        const aiResponse = `🏛️ I can see this is **${a.name}**! (${confidence}% confident)\n\n📍 **Location:** ${a.city}${a.district ? `, ${a.district}` : ''}\n\n📖 **About:** ${a.description}\n\n🕐 **Opening Hours:** ${a.opening_hours ?? 'N/A'}\n\n💰 **Admission:** ${a.admission_egp ? `${a.admission_egp} EGP` : 'Free'}\n\n⭐ **Rating:** ${a.rating}/5\n\n👥 **Crowd:** ${a.crowd_label ?? 'N/A'} — ${a.crowd_pattern ?? ''}\n\nWould you like me to add this to your itinerary or tell you more about it? 😊`;

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiResponse,
          timestamp: new Date(),
        }]);

      } else if (result.recognized && !result.attraction) {
        // Recognized by model but not in database
        const confidence = Math.round(result.confidence * 100);
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `🏛️ I think this is **${result.model_label?.replace(/_/g, ' ')}** (${confidence}% confident) but I don't have detailed information about it yet in my database.\n\nWould you like me to search for more information? 🔍`,
          timestamp: new Date(),
        }]);

      } else {
        // Not recognized
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "🤔 I couldn't clearly identify this landmark. For best results:\n\n📸 Make sure the landmark fills most of the frame\n☀️ Good lighting helps a lot\n📐 Try a straight-on angle\n\nWould you like to try another photo? 😊",
          timestamp: new Date(),
        }]);
      }

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

  // ── Pick image from gallery ─────────────────────────────────────
  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photo library.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      showModelTypeAlert(result.assets[0].uri);
    }
  };

  // ── Take photo with camera ──────────────────────────────────────
  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your camera.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      showModelTypeAlert(result.assets[0].uri);
    }
  };

  // ── Ask user: outdoor or museum artifact ───────────────────────
  const showModelTypeAlert = (imageUri: string) => {
    Alert.alert(
      'What type of landmark?',
      'Is this an outdoor landmark or a museum artifact?',
      [
        { text: 'Outdoor Landmark', onPress: () => recognizeLandmark(imageUri, 'outdoor') },
        { text: 'Museum Artifact', onPress: () => recognizeLandmark(imageUri, 'artifact') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // ── Pulse animation helpers ─────────────────────────────────────
  const startPulse = () => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  };

  const stopPulse = () => {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  };

  // ── Voice mode: start recording ─────────────────────────────────
  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow microphone access.');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setVoiceStatus('Listening… tap to stop');
      startPulse();
    } catch (err) {
      console.error('Recording start error:', err);
      setVoiceStatus('Could not start recording');
    }
  };

  // ── Voice mode: stop recording & transcribe ─────────────────────
  // isTranscribing resets as soon as transcription finishes — never
  // waits for the AI or TTS phases.
  const stopRecordingAndTranscribe = async () => {
    if (!recordingRef.current) return;
    stopPulse();
    setIsRecording(false);
    setIsTranscribing(true);
    setVoiceStatus('Transcribing…');
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No recording URI');

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const res = await fetch(`${API_BASE}/ai/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64 }),
      });
      const data = await res.json();
      if (data.success && data.text) {
        setVoiceTranscript(data.text);
        // Do NOT await — AI + TTS run independently; isTranscribing
        // resets in the finally below without waiting for them.
        sendVoiceMessage(data.text);
      } else {
        setVoiceStatus("Couldn't understand — try again");
      }
    } catch (err) {
      console.error('Transcribe error:', err);
      setVoiceStatus('Error transcribing — try again');
    } finally {
      setIsTranscribing(false);  // resets right here, never blocked by AI/TTS
    }
  };

  // ── AI chat phase; loading resets as soon as the reply arrives ──
  // TTS is fired without await so loading is never blocked by it.
  const sendVoiceMessage = async (text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    }]);
    setLoading(true);
    setVoiceStatus('Tour Mate is thinking…');

    let aiText = '';
    try {
      const conversationHistory = messages
        .filter(m => m.id !== '0')
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...conversationHistory, { role: 'user', content: text }],
        }),
      });
      const data = await response.json();
      if (data.success && data.message) {
        aiText = data.message;
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiText,
          timestamp: new Date(),
        }]);
        setVoiceAiResponse(aiText);
      } else {
        throw new Error(data.error ?? 'No response');
      }
    } catch (err) {
      console.error('Voice chat error:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I couldn't process that. Please try again! 🙏",
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);        // resets here — never blocked by TTS
      setVoiceTranscript('');
      if (!aiText) setVoiceStatus('Tap microphone to speak');
    }

    if (aiText) {
      setVoiceStatus('Speaking…');
      // Fire TTS without await — isSpeakingVoice/voiceStatus manage
      // their own state; a TTS hang can no longer freeze the mic button.
      speakVoiceResponse(aiText);
    }
  };

  // ── Speak AI response via /api/ai/speak ────────────────────────
  const speakVoiceResponse = async (text: string) => {
    setIsSpeakingVoice(true);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      const res = await fetch(`${API_BASE}/ai/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();

      const playBase64 = (b64: string, mimeType: string) =>
        new Promise<void>((resolve) => {
          let settled = false;
          const settle = () => { if (!settled) { settled = true; resolve(); } };

          // Safety timeout — never stay stuck longer than 60s
          const timer = setTimeout(settle, 60_000);

          Audio.Sound.createAsync(
            { uri: `data:${mimeType};base64,${b64}` },
            { shouldPlay: true },
            // Third arg = onPlaybackStatusUpdate, registered before playback starts
            // so we can never miss the didJustFinish event
            (status: any) => {
              if (status.didJustFinish) { clearTimeout(timer); settle(); }
              if (!status.isLoaded && status.error) { clearTimeout(timer); settle(); }
            }
          ).then(({ sound }) => {
            voiceSoundRef.current = sound;
          }).catch(() => { clearTimeout(timer); settle(); });
        });

      if (data.audioChunks && data.audioChunks.length > 0) {
        for (const chunk of data.audioChunks) {
          await playBase64(chunk, 'audio/wav');
        }
      } else if (data.audio) {
        await playBase64(data.audio, 'audio/mpeg');
      }
    } catch (err) {
      console.error('Voice speak error:', err);
    } finally {
      setIsSpeakingVoice(false);
      setVoiceStatus('Tap microphone to speak');
      setVoiceAiResponse('');
      if (voiceSoundRef.current) {
        try { await voiceSoundRef.current.unloadAsync(); } catch {}
        voiceSoundRef.current = null;
      }
    }
  };

  // ── Open / close voice mode ─────────────────────────────────────
  const openVoiceMode = () => {
    setVoiceModeVisible(true);
    setVoiceTranscript('');
    setVoiceAiResponse('');
    setVoiceStatus('Tap microphone to speak');
  };

  const closeVoiceMode = async () => {
    // Stop recording if active
    if (isRecording && recordingRef.current) {
      stopPulse();
      setIsRecording(false);
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
    // Stop playback if active
    if (voiceSoundRef.current) {
      try { await voiceSoundRef.current.stopAsync(); } catch {}
      voiceSoundRef.current = null;
    }
    setIsSpeakingVoice(false);
    setIsTranscribing(false);
    setVoiceTranscript('');
    setVoiceAiResponse('');
    setVoiceStatus('Tap microphone to speak');
    setVoiceModeVisible(false);
  };

  // ── Show image options ──────────────────────────────────────────
  const showImageOptions = () => {
    Alert.alert(
      'Identify a Landmark',
      'Take a photo or choose from your gallery',
      [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Gallery', onPress: pickFromGallery },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

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
            timestamp: new Date()
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
              <View style={styles.aiAvatar}><MaterialCommunityIcons name="robot-outline" size={20} color="#E67E22" /></View>
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
                    onPress={() => sendMessage(suggestion)}
                  >
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input bar with camera + mic buttons */}
        <View style={styles.inputBar}>
          {/* Camera button */}
          <TouchableOpacity
            style={[styles.cameraBtn, recognizing && styles.cameraBtnDisabled]}
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

          {/* Microphone button */}
          <TouchableOpacity
            style={[styles.micBtn, loading && styles.cameraBtnDisabled]}
            onPress={openVoiceMode}
            disabled={loading || recognizing}
          >
            <MaterialCommunityIcons name="microphone-outline" size={22} color="#E67E22" />
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

      {/* ── Voice Mode Overlay ──────────────────────────────────── */}
      <Modal visible={voiceModeVisible} transparent animationType="fade" onRequestClose={closeVoiceMode}>
        <View style={styles.voiceOverlay}>
          <View style={styles.voiceCard}>
            {/* Header */}
            <View style={styles.voiceHeader}>
              <View style={styles.aiAvatar}>
                <MaterialCommunityIcons name="robot-outline" size={20} color="#E67E22" />
              </View>
              <Text style={styles.voiceTitle}>Voice Mode</Text>
              <TouchableOpacity onPress={closeVoiceMode} style={styles.voiceCloseBtn}>
                <MaterialCommunityIcons name="close" size={22} color="#999" />
              </TouchableOpacity>
            </View>

            {/* Status */}
            <Text style={styles.voiceStatus}>{voiceStatus}</Text>

            {/* What the user said */}
            {voiceTranscript.length > 0 && (
              <View style={styles.transcriptBox}>
                <Text style={styles.transcriptLabel}>You</Text>
                <Text style={styles.transcriptText}>"{voiceTranscript}"</Text>
              </View>
            )}

            {/* AI's written response */}
            {voiceAiResponse.length > 0 && (
              <View style={styles.aiResponseBox}>
                <Text style={styles.aiResponseLabel}>Tour Mate</Text>
                <ScrollView style={styles.aiResponseScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.aiResponseText}>{voiceAiResponse}</Text>
                </ScrollView>
              </View>
            )}

            {/* Pulse mic button */}
            <View style={styles.voiceMicWrapper}>
              {isRecording && (
                <Animated.View style={[styles.voicePulse, { transform: [{ scale: pulseAnim }] }]} />
              )}
              <TouchableOpacity
                style={[
                  styles.voiceMicBtn,
                  isRecording && styles.voiceMicBtnActive,
                  (isTranscribing || isSpeakingVoice || loading) && styles.voiceMicBtnDisabled,
                ]}
                onPress={isRecording ? stopRecordingAndTranscribe : startRecording}
                disabled={isTranscribing || isSpeakingVoice || loading}
                activeOpacity={0.85}
              >
                {isTranscribing || loading ? (
                  <ActivityIndicator size="large" color="#FFF" />
                ) : isSpeakingVoice ? (
                  <MaterialCommunityIcons name="volume-high" size={36} color="#FFF" />
                ) : (
                  <MaterialCommunityIcons
                    name={isRecording ? 'stop' : 'microphone'}
                    size={36}
                    color="#FFF"
                  />
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.voiceHint}>
              {isRecording ? 'Tap to stop recording' : isTranscribing ? 'Processing…' : isSpeakingVoice ? 'Playing response…' : 'Tap the mic to start'}
            </Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  backIcon: { fontSize: 22, fontWeight: '700', color: '#333' },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#1A1A1A' },
  onlineBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#27AE60' },
  onlineText: { fontSize: 11, color: '#27AE60', fontWeight: '600' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F5F5F5' },
  clearBtnText: { fontSize: 13, color: '#999', fontWeight: '600' },
  messagesContainer: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 20 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 12, gap: 8 },
  bubbleRowUser: { flexDirection: 'row-reverse' },
  aiAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  aiAvatarIcon: { fontSize: 18 },
  bubble: { borderRadius: 20, padding: 12, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  bubbleAI: { backgroundColor: '#FFF', borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: '#E67E22', borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: '#1A1A1A', lineHeight: 20 },
  bubbleTextUser: { color: '#FFF' },
  bubbleTime: { fontSize: 10, color: '#BBB', marginTop: 4, textAlign: 'right' },
  bubbleTimeUser: { color: 'rgba(255,255,255,0.7)' },
  messageImage: { width: width * 0.65, height: 180, borderRadius: 16, marginBottom: 4, borderBottomLeftRadius: 4 },
  messageImageUser: { borderBottomLeftRadius: 16, borderBottomRightRadius: 4 },
  speakBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: '#FFF3E0', borderWidth: 1, borderColor: '#FDDCB5' },
  speakBtnActive: { backgroundColor: '#FFE5E5', borderColor: '#FFAAAA' },
  speakBtnPaused: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
  speakBtnText: { fontSize: 11, color: '#E67E22', fontWeight: '700' },
  speakBtnTextActive: { color: '#E74C3C' },
  speakBtnTextPaused: { color: '#27AE60' },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 20, borderBottomLeftRadius: 4, padding: 12 },
  typingText: { fontSize: 13, color: '#999' },
  suggestionsContainer: { marginTop: 8 },
  suggestionsTitle: { fontSize: 13, color: '#999', fontWeight: '600', marginBottom: 10 },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: { backgroundColor: '#FFF', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#EEE', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  suggestionText: { fontSize: 13, color: '#555', fontWeight: '500' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 28, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#F0F0F0', gap: 10 },
  cameraBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FDDCB5' },
  cameraBtnDisabled: { opacity: 0.5 },
  cameraIcon: { fontSize: 20 },
  input: { flex: 1, backgroundColor: '#F5F5F5', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#333', maxHeight: 100, borderWidth: 1, borderColor: '#EEE' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#E67E22', justifyContent: 'center', alignItems: 'center', shadowColor: '#E67E22', shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  sendBtnDisabled: { backgroundColor: '#DDD', shadowOpacity: 0 },
  sendIcon: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  micBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FDDCB5' },
  // Voice mode overlay
  voiceOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  voiceCard: { width: '100%', backgroundColor: '#FFF', borderRadius: 28, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, elevation: 10 },
  voiceHeader: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 18, gap: 10 },
  voiceTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
  voiceCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center' },
  voiceStatus: { fontSize: 15, color: '#666', marginBottom: 16, textAlign: 'center' },
  transcriptBox: { backgroundColor: '#FFF8F0', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 10, width: '100%', borderWidth: 1, borderColor: '#FDDCB5' },
  transcriptLabel: { fontSize: 11, fontWeight: '700', color: '#E67E22', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  transcriptText: { fontSize: 14, color: '#555', fontStyle: 'italic' },
  aiResponseBox: { backgroundColor: '#F0F8FF', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, width: '100%', borderWidth: 1, borderColor: '#B3D9F5', maxHeight: 160 },
  aiResponseLabel: { fontSize: 11, fontWeight: '700', color: '#2980B9', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  aiResponseScroll: { flexGrow: 0 },
  aiResponseText: { fontSize: 14, color: '#333', lineHeight: 20 },
  voiceMicWrapper: { width: 120, height: 120, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  voicePulse: { position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(230,126,34,0.2)' },
  voiceMicBtn: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#E67E22', justifyContent: 'center', alignItems: 'center', shadowColor: '#E67E22', shadowOpacity: 0.4, shadowRadius: 12, elevation: 6 },
  voiceMicBtnActive: { backgroundColor: '#C0392B', shadowColor: '#C0392B' },
  voiceMicBtnDisabled: { backgroundColor: '#CCC', shadowOpacity: 0 },
  voiceHint: { fontSize: 13, color: '#AAA', textAlign: 'center' },
});
