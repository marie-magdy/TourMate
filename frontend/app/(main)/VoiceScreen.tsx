
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, Platform,
} from 'react-native';
import { Theme } from '../../constants/theme';
import TourMateAvatar from '@/components/TourMateAvatar';
import DesertTriangles from '../../components/DesertTriangles';

interface VoiceScreenProps {
  isFemale:    boolean;
  isSpeaking:  boolean;
  isThinking:  boolean;
  isListening: boolean;
  isRecording: boolean;
  statusText:  string;
  onClose:     () => void;
  onToggleGender: () => void;
  onToggleMic: () => void;
  onStop:      () => void;
}

export const VoiceScreen: React.FC<VoiceScreenProps> = ({
  isFemale, isSpeaking, isThinking, isListening,
  isRecording, statusText, onClose, onToggleGender, onToggleMic, onStop,
}) => {
  const stateColor = isSpeaking  ? Theme.colors.primary
                   : isListening ? Theme.colors.info
                   : isThinking  ? '#9B59B6'
                   : Theme.colors.muted;

  const stateLabel = isSpeaking  ? 'Speaking'
                   : isListening ? 'Listening'
                   : isThinking  ? 'Thinking'
                   : 'Ready';

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

<View style={StyleSheet.absoluteFill} pointerEvents="none">
  <DesertTriangles />
</View>
      <SafeAreaView style={s.safe}>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>TourMate Voice</Text>
            <View style={[s.statePill, { backgroundColor: stateColor + '18' }]}>
              <View style={[s.stateDot, { backgroundColor: stateColor }]} />
              <Text style={[s.stateText, { color: stateColor }]}>{stateLabel}</Text>
            </View>
          </View>

          {/* Gender toggle — top right, subtle */}
          <TouchableOpacity style={s.genderBtn} onPress={onToggleGender}>
            <Text style={s.genderBtnIcon}>{isFemale ? '♀' : '♂'}</Text>
            <Text style={s.genderBtnLabel}>{isFemale ? 'Female' : 'Male'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Avatar area ── */}
        <View style={s.avatarArea}>
          <TourMateAvatar
            isSpeaking={isSpeaking}
            isThinking={isThinking}
            isListening={isListening}
            isFemale={isFemale}
          />

          {/* Status text */}
          <Text style={s.statusText}>{statusText}</Text>
        </View>

        {/* ── Controls ── */}
        <View style={s.controls}>

          {/* Stop button — only when speaking */}
          {isSpeaking && (
            <TouchableOpacity style={s.stopBtn} onPress={onStop}>
              <View style={s.stopIcon} />
              <Text style={s.stopBtnText}>Stop</Text>
            </TouchableOpacity>
          )}

{/* Mic button */}
<TouchableOpacity
  style={[s.micBtn, isRecording && s.micBtnActive, (isSpeaking || isThinking) && s.micBtnDisabled]}
  onPress={onToggleMic}
  disabled={isSpeaking || isThinking}
  activeOpacity={0.8}
>
  {/* Pulse rings when recording */}
  {isRecording && (
    <>
      <View style={[s.micPulse, s.micPulse1]} />
      <View style={[s.micPulse, s.micPulse2]} />
    </>
  )}
  {/* REPLACE the Text line with this */}
  <View style={[s.micIconInner, isRecording && s.micIconInnerActive]} />
</TouchableOpacity>

<Text style={s.micHint}>
  {isRecording ? 'Tap to stop' : isSpeaking || isThinking ? 'Please wait' : 'Tap to speak'}
</Text>

        </View>

        {/* ── Bottom safe padding ── */}
        <View style={{ height: 20 }} />

      </SafeAreaView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },



  safe: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 16 : 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.border,
    backgroundColor: Theme.colors.card,
  },

  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Theme.colors.chipBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    color: Theme.colors.muted,
    fontWeight: '700',
  },

  headerCenter: {
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Theme.colors.hero,
    letterSpacing: 0.3,
  },

  statePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
  },
  stateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stateText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // Gender toggle — compact top right
  genderBtn: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Theme.colors.chipBg,
    borderWidth: 1,
    borderColor: Theme.colors.border,
    minWidth: 56,
  },
  genderBtnIcon: {
    fontSize: 16,
    color: Theme.colors.primary,
    fontWeight: '700',
  },
  genderBtnLabel: {
    fontSize: 10,
    color: Theme.colors.muted,
    fontWeight: '600',
  },

  // Avatar
  avatarArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },

  statusText: {
    fontSize: 15,
    color: Theme.colors.muted,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },

  // Controls
  controls: {
    alignItems: 'center',
    paddingBottom: 24,
    gap: 14,
  },

  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: Theme.colors.errorBg,
    borderWidth: 1,
    borderColor: Theme.colors.error + '30',
  },
  stopIcon: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: Theme.colors.error,
  },
  stopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.colors.error,
  },

  // Mic button
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Theme.colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  micBtnActive: {
    backgroundColor: Theme.colors.error,
    shadowColor: Theme.colors.error,
  },
  micBtnDisabled: {
    backgroundColor: Theme.colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  micIcon: {
    fontSize: 28,
    color: '#FFF',
  },

  // Pulse rings
  micPulse: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: Theme.colors.error,
  },
  micPulse1: {
    width: 100,
    height: 100,
    opacity: 0.3,
  },
  micPulse2: {
    width: 120,
    height: 120,
    opacity: 0.15,
  },

  micHint: {
    fontSize: 12,
    color: Theme.colors.muted,
    fontWeight: '500',
  },
  micIconInner: {
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: '#FFF',
},
micIconInnerActive: {
  width: 22,
  height: 22,
  borderRadius: 4,
},
});

export default VoiceScreen;
