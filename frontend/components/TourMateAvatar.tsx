import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import Svg, {
  Ellipse, Rect, Path, Circle, G, Defs, RadialGradient, Stop,
} from 'react-native-svg';

// ─────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────
interface TourMateAvatarProps {
  isSpeaking:  boolean;
  isThinking:  boolean;
  isListening: boolean;
  isFemale:    boolean;
}

// ─────────────────────────────────────────────────────────────
//  Sound Bars  (speaking / listening)
// ─────────────────────────────────────────────────────────────
const SoundBars: React.FC<{ color: string; fast?: boolean }> = ({ color, fast }) => {
  const bars = Array.from({ length: 6 }, () => useRef(new Animated.Value(4)).current);
  useEffect(() => {
    const anims = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 4 + Math.random() * 18, duration: fast ? 160 + i * 30 : 220 + i * 45, useNativeDriver: false }),
          Animated.timing(b, { toValue: 4, duration: fast ? 160 + i * 30 : 220 + i * 45, useNativeDriver: false }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={styles.barsRow}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{ width: 4, height: b, borderRadius: 3, backgroundColor: color, marginHorizontal: 2 }} />
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
//  Thinking Dots
// ─────────────────────────────────────────────────────────────
const ThinkingDots: React.FC = () => {
  const dots = [0, 1, 2].map(() => useRef(new Animated.Value(0)).current);
  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(d, { toValue: -7, duration: 320, useNativeDriver: true }),
          Animated.timing(d, { toValue: 0,  duration: 320, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);
  return (
    <View style={styles.dotsRow}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: d }] }]} />
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
//  Main Avatar
// ─────────────────────────────────────────────────────────────
const TourMateAvatar: React.FC<TourMateAvatarProps> = ({
  isSpeaking, isThinking, isListening, isFemale,
}) => {
  // — Animation refs —
  const blinkAnim    = useRef(new Animated.Value(1)).current;
  const mouthAnim    = useRef(new Animated.Value(0)).current;
  const bobAnim      = useRef(new Animated.Value(0)).current;
  const browAnim     = useRef(new Animated.Value(0)).current;
  const eyeMoveAnim  = useRef(new Animated.Value(0)).current; // -1 left, 0 center, 1 right
  const haloAnim     = useRef(new Animated.Value(0)).current;
  const halo2Anim    = useRef(new Animated.Value(0)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;

  // — Palette —
  const skin       = isFemale ? '#F0C898' : '#F0C898';
  const skinShadow = isFemale ? '#D4986A' : '#D4986A';
  const skinDeep   = isFemale ? '#B87040' : '#B87040';
  const hairColor  = '#1A0800';
  const hairHi     = '#3A1400';

  // — Aura color by state —
  const auraColor = isSpeaking  ? '#E67E22'
                  : isListening ? '#2980B9'
                  : isThinking  ? '#9B59B6'
                  : 'transparent';

  // ── Blink every 3.5 s ──────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      Animated.sequence([
        Animated.timing(blinkAnim, { toValue: 0.06, duration: 75,  useNativeDriver: true }),
        Animated.timing(blinkAnim, { toValue: 1,    duration: 75,  useNativeDriver: true }),
      ]).start();
    }, 3500);
    return () => clearInterval(t);
  }, []);

  // ── Random eye movement ─────────────────────────────────────
  useEffect(() => {
    const move = () => {
      const target = [-1, 0, 0, 1][Math.floor(Math.random() * 4)];
      Animated.sequence([
        Animated.timing(eyeMoveAnim, { toValue: target, duration: 200, useNativeDriver: true }),
        Animated.delay(1200 + Math.random() * 1800),
        Animated.timing(eyeMoveAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setTimeout(move, 400 + Math.random() * 600));
    };
    const t = setTimeout(move, 2000);
    return () => clearTimeout(t);
  }, []);

  // ── State-driven animations ─────────────────────────────────
  useEffect(() => {
    if (isSpeaking) {
      // mouth open/close
      const m = Animated.loop(Animated.sequence([
        Animated.timing(mouthAnim, { toValue: 1,   duration: 140, useNativeDriver: false }),
        Animated.timing(mouthAnim, { toValue: 0.2, duration: 140, useNativeDriver: false }),
      ]));
      // body bob – faster
      const b = Animated.loop(Animated.sequence([
        Animated.timing(bobAnim, { toValue: -3, duration: 320, useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue:  3, duration: 320, useNativeDriver: true }),
      ]));
      // halo pulse
      const h = Animated.loop(Animated.sequence([
        Animated.timing(haloAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(haloAnim,  { toValue: 0, duration: 600, useNativeDriver: true }),
      ]));
      const h2 = Animated.loop(Animated.sequence([
        Animated.delay(300),
        Animated.timing(halo2Anim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(halo2Anim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]));
      const p = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 500, useNativeDriver: true }),
      ]));
      m.start(); b.start(); h.start(); h2.start(); p.start();
      return () => {
        m.stop(); b.stop(); h.stop(); h2.stop(); p.stop();
        mouthAnim.setValue(0); bobAnim.setValue(0);
        haloAnim.setValue(0); halo2Anim.setValue(0); pulseAnim.setValue(1);
      };
    }
    if (isListening) {
      const b = Animated.loop(Animated.sequence([
        Animated.timing(bobAnim, { toValue: -2, duration: 380, useNativeDriver: true }),
        Animated.timing(bobAnim, { toValue:  2, duration: 380, useNativeDriver: true }),
      ]));
      const h = Animated.loop(Animated.sequence([
        Animated.timing(haloAnim,  { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(haloAnim,  { toValue: 0, duration: 800, useNativeDriver: true }),
      ]));
      const h2 = Animated.loop(Animated.sequence([
        Animated.delay(400),
        Animated.timing(halo2Anim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(halo2Anim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]));
      b.start(); h.start(); h2.start();
      return () => {
        b.stop(); h.stop(); h2.stop();
        bobAnim.setValue(0); haloAnim.setValue(0); halo2Anim.setValue(0);
      };
    }
    if (isThinking) {
      const br = Animated.loop(Animated.sequence([
        Animated.timing(browAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(browAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]));
      const h = Animated.loop(Animated.sequence([
        Animated.timing(haloAnim,  { toValue: 0.6, duration: 1000, useNativeDriver: true }),
        Animated.timing(haloAnim,  { toValue: 0,   duration: 1000, useNativeDriver: true }),
      ]));
      br.start(); h.start();
      return () => {
        br.stop(); h.stop();
        browAnim.setValue(0); haloAnim.setValue(0);
      };
    }
    // idle gentle bob
    const idle = Animated.loop(Animated.sequence([
      Animated.timing(bobAnim, { toValue: -1.5, duration: 2200, useNativeDriver: true }),
      Animated.timing(bobAnim, { toValue:  1.5, duration: 2200, useNativeDriver: true }),
    ]));
    idle.start();
    return () => { idle.stop(); bobAnim.setValue(0); };
  }, [isSpeaking, isThinking, isListening]);

  // — Interpolations —
const mouthH = mouthAnim.interpolate({ inputRange: [0, 1], outputRange: [11, 20] });
  const browOff = browAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const eyeX    = eyeMoveAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-2, 0, 2] });
  const haloOp  = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.55] });
  const halo2Op = halo2Anim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  return (
    <View style={styles.outerWrap}>
      {/* ── Background halos ─────────────────────────────── */}
      {auraColor !== 'transparent' && (
        <>
          <Animated.View style={[
            styles.halo, styles.haloOuter,
            { borderColor: auraColor, opacity: halo2Op, transform: [{ scale: pulseAnim }] },
          ]} />
          <Animated.View style={[
            styles.halo, styles.haloInner,
            { borderColor: auraColor, opacity: haloOp, transform: [{ scale: pulseAnim }] },
          ]} />
          {/* Soft glow fill */}
          <Animated.View style={[
            styles.haloGlow,
            { backgroundColor: auraColor, opacity: halo2Op },
          ]} />
        </>
      )}

      {/* ── Avatar body ──────────────────────────────────── */}
      <Animated.View style={[styles.avatarWrap, { transform: [{ translateY: bobAnim }] }]}>
        <Svg width={180} height={230} viewBox="0 0 180 230">
          <Defs>
            <RadialGradient id="skinGrad" cx="50%" cy="40%" r="60%">
              <Stop offset="0%"   stopColor={skin}       stopOpacity="1" />
              <Stop offset="100%" stopColor={skinShadow} stopOpacity="1" />
            </RadialGradient>
          </Defs>

          {/* ── Neck ─────────────────────────────────────── */}
          <Rect x="76" y="160" width="28" height="28" rx="8" fill={skin} />
          <Rect x="82" y="160" width="16" height="8"  rx="4" fill={skinShadow} opacity="0.4" />

          {/* ── CLOTHES ──────────────────────────────────── */}
          {isFemale ? (
            <G>
              {/* Red dress */}
              <Path d="M10 230 Q30 180 76 170 L104 170 Q150 180 170 230 Z" fill="#C0392B" />
              <Path d="M18 230 Q36 182 76 170 L104 170 Q144 182 162 230 Z" fill="#9B1E1E" />

              {/* Gold necklace */}
              <Path d="M66 174 Q90 186 114 174" stroke="#F5C842" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <Circle cx="74"  cy="179" r="3" fill="#F5C842" />
              <Circle cx="82"  cy="182" r="3" fill="#F5C842" />
              <Circle cx="90"  cy="184" r="3" fill="#F5C842" />
              <Circle cx="98"  cy="182" r="3" fill="#F5C842" />
              <Circle cx="106" cy="179" r="3" fill="#F5C842" />
            </G>
          ) : (
            <G>
              {/* Khaki shirt */}
              <Path d="M10 230 Q30 180 76 170 L104 170 Q150 180 170 230 Z" fill="#8B6914" />
              <Path d="M18 230 Q36 182 76 170 L104 170 Q144 182 162 230 Z" fill="#A07C20" />
              {/* Lapels */}
              <Path d="M76 170 L84 160 L90 190 Z" fill="#5A3A00" opacity="0.9" />
              <Path d="M104 170 L96 160 L90 190 Z" fill="#5A3A00" opacity="0.9" />
              {/* Badge */}
              <Circle cx="62" cy="182" r="6" fill="#F5C842" />
              <Circle cx="62" cy="182" r="3.5" fill="#C8980A" />
            </G>
          )}

          {/* ── Head ─────────────────────────────────────── */}
          <Ellipse cx="90" cy="108" rx="52" ry="56" fill="url(#skinGrad)" />

          {/* Cheek blush */}
          <Ellipse cx="56"  cy="118" rx="16" ry="10" fill={isFemale?'#F09878':'#E09060'} opacity="0.22" />
          <Ellipse cx="124" cy="118" rx="16" ry="10" fill={isFemale?'#F09878':'#E09060'} opacity="0.22" />

          {/* ── HAIR ─────────────────────────────────────── */}
          {isFemale ? (
            <G>
{/* Left side */}
<Path d="M36 70 Q26 76 20 96 Q16 116 20 140 Q32 156 52 150 Q44 122 42 94 Q40 78 36 70 Z" fill={hairColor} />

{/* Right side */}
<Path d="M144 70 Q154 76 160 96 Q164 116 160 140 Q148 156 128 150 Q136 122 138 94 Q140 78 144 70 Z" fill={hairColor} />

{/* Top dome */}
<Path d="M34 86 Q36 64 50 54 Q66 44 90 42 Q114 44 130 54 Q144 64 146 86 Q118 84 90 82 Q62 84 34 86 Z" fill={hairColor} />

{/* Highlight */}
<Ellipse cx="76" cy="56" rx="20" ry="8" fill={hairHi} opacity="0.5" />
              {/* Fringe peek under brim */}
              <Path d="M36 80 Q50 72 90 70 Q130 72 144 80 Q130 76 90 74 Q50 76 36 80 Z" fill={hairColor} opacity="0.6" />
            </G>
          ) : (
            <G>
              {/* Short male hair */}
              <Path d="M38 92 Q40 52 90 46 Q140 52 142 92 Q125 70 90 68 Q55 70 38 92 Z" fill={hairColor} />
              {/* Hair highlight */}
              <Ellipse cx="76" cy="58" rx="18" ry="7" fill={hairHi} opacity="0.45" />
            </G>
          )}

          {/* ── Ears (female ears hidden by hair) ────────── */}
          {!isFemale && (
            <G>
              <Ellipse cx="33"  cy="112" rx="8" ry="11" fill={skin} />
              <Ellipse cx="148" cy="112" rx="8" ry="11" fill={skin} />
              <Ellipse cx="33"  cy="113" rx="5" ry="8"  fill={skinShadow} />
              <Ellipse cx="148" cy="113" rx="5" ry="8"  fill={skinShadow} />
            </G>
          )}
          {/* Female earrings peek below hair */}
          {isFemale && (
            <G>
              <Circle cx="32"  cy="124" r="4" fill="#F5C842" />
              <Circle cx="148" cy="124" r="4" fill="#F5C842" />
            </G>
          )}

          {/* ── HAT brim — cuts across forehead ──────────── */}
{/* Brim — wider than crown, sticks out both sides */}
<Ellipse cx="90" cy="67" rx="76" ry="11" fill="#3A2000" />
<Ellipse cx="90" cy="64" rx="74" ry="10" fill="#6A4410" />

{/* Crown — vertical sides, flat top */}
<Rect x="44" y="14" width="92" height="52" fill="#C8A040" />
<Rect x="112" y="14" width="24" height="52" fill="#8A6810" opacity="0.35" />

{/* Crown highlight */}
<Ellipse cx="72" cy="24" rx="22" ry="7" fill="#EAC860" opacity="0.45" />

{/* Hat band — sits at bottom of crown just above brim */}
<Rect x="30" y="54" width="120" height="10" fill="#1A0A00" />
{/* Band highlight */}
<Path d="M30 55 L150 55" stroke="#3A1800" strokeWidth="1.5" opacity="0.6" />

{/* Forehead shadow */}
<Ellipse cx="90" cy="72" rx="54" ry="7" fill={hairColor} opacity="0.12" />

          {/* ── Eyebrows ──────────────────────────────────── */}
          <Animated.View style={{ position: 'absolute', left: 44, top: 72, transform: [{ translateY: browOff }] }}>
            <Svg width="42" height="12">
              {isFemale
                ? <Path d="M2 9 Q21 2 40 6" stroke={hairColor} strokeWidth="2.2" strokeLinecap="round" fill="none" />
                : <Path d="M2 8 Q21 2 40 6" stroke={hairColor} strokeWidth="3.6" strokeLinecap="round" fill="none" />
              }
            </Svg>
          </Animated.View>
          <Animated.View style={{ position: 'absolute', left: 94, top: 72, transform: [{ translateY: browOff }] }}>
            <Svg width="42" height="12">
              {isFemale
                ? <Path d="M2 6 Q21 2 40 9" stroke={hairColor} strokeWidth="2.2" strokeLinecap="round" fill="none" />
                : <Path d="M2 6 Q21 2 40 8" stroke={hairColor} strokeWidth="3.6" strokeLinecap="round" fill="none" />
              }
            </Svg>
          </Animated.View>

          {/* ── Eye whites ────────────────────────────────── */}
          <Ellipse cx="68"  cy="100" rx="14" ry="11" fill="#F8F2E8" />
          <Ellipse cx="112" cy="100" rx="14" ry="11" fill="#F8F2E8" />

          {/* ── Kohl eyeliner ─────────────────────────────── */}
          {isFemale ? (
            <G>
              {/* Cat eye */}
              <Path d="M54 100 L48 97" stroke="#0A0400" strokeWidth="2" strokeLinecap="round" />
              <Path d="M126 100 L132 97" stroke="#0A0400" strokeWidth="2" strokeLinecap="round" />
              <Path d="M54 92 Q68 88 82 92"  stroke="#0A0400" strokeWidth="2" strokeLinecap="round" fill="none" />
              <Path d="M98 92 Q112 88 126 92" stroke="#0A0400" strokeWidth="2" strokeLinecap="round" fill="none" />
            </G>
          ) : (
            <G>
              <Path d="M54 100 L48 102" stroke="#0A0400" strokeWidth="1.8" strokeLinecap="round" />
              <Path d="M126 100 L132 102" stroke="#0A0400" strokeWidth="1.8" strokeLinecap="round" />
            </G>
          )}

          {/* ── Pupils (animated blink + eye move) ───────── */}
          <Animated.View style={{ position: 'absolute', left: 50, top: 88, transform: [{ scaleY: blinkAnim }, { translateX: eyeX }] }}>
            <Svg width="36" height="24">
              <Circle cx="18" cy="12" r="8"   fill={isFemale ? '#5D2A1A' : '#1A3A5C'} />
              <Circle cx="18" cy="12" r="4.5" fill="#0A0804" />
              <Circle cx="22" cy="8"  r="3"   fill="#FFF" opacity="0.9" />
              <Circle cx="16" cy="14" r="1.5" fill="#FFF" opacity="0.5" />
            </Svg>
          </Animated.View>
          <Animated.View style={{ position: 'absolute', left: 94, top: 88, transform: [{ scaleY: blinkAnim }, { translateX: eyeX }] }}>
            <Svg width="36" height="24">
              <Circle cx="18" cy="12" r="8"   fill={isFemale ? '#5D2A1A' : '#1A3A5C'} />
              <Circle cx="18" cy="12" r="4.5" fill="#0A0804" />
              <Circle cx="22" cy="8"  r="3"   fill="#FFF" opacity="0.9" />
              <Circle cx="16" cy="14" r="1.5" fill="#FFF" opacity="0.5" />
            </Svg>
          </Animated.View>

          {/* ── Nose ──────────────────────────────────────── */}
          {isFemale ? (
  <G>
    <Path
      d="M88 108 L87 118 Q84 124 83 128 Q90 132 97 128 Q96 124 93 118 L92 108"
      stroke={skinDeep} strokeWidth="1.5" fill="none" strokeLinecap="round"
    />
    <Ellipse cx="85" cy="128" rx="4" ry="3" fill={skinShadow} opacity="0.28" />
    <Ellipse cx="95" cy="128" rx="4" ry="3" fill={skinShadow} opacity="0.28" />
    <Ellipse cx="90" cy="128" rx="8"  ry="3" fill={skinShadow} opacity="0.15" />
  </G>
          ) : (
            /* Stronger male nose with bridge */
            <G>
              <Path d="M88 96 L86 112 Q82 120 83 126 Q90 130 97 126 Q98 120 94 112 L92 96"
                    stroke={skinDeep} strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <Ellipse cx="90" cy="126" rx="9" ry="4" fill={skinShadow} opacity="0.18" />
            </G>
          )}

{/* ── Mouth ─────────────────────────────────────────── */}
{isSpeaking ? (
  <Animated.View style={{ position: 'absolute', left: 66, top: 134, overflow: 'hidden' }}>
    <Animated.View style={{ height: mouthH, width: 48, overflow: 'hidden' }}>
      <Svg width="48" height="20">
        {/* Upper lip */}
        <Path
           d="M2 9 Q24 4 46 9 Q38 8 24 10 Q10 8 2 9 Z"
          fill={isFemale ? '#C85060' : '#A04030'}
        />
        {/* Mouth cavity */}
        <Path
          d="M2 6 Q24 20 46 6 Q24 16 2 6 Z"
          fill="#5A1A1A"
        />
        {/* Teeth */}
        <Path
          d="M6 7 Q24 14 42 7 Q24 12 6 7 Z"
          fill="#F5EEE8" opacity="0.9"
        />
        {/* Bottom lip */}
        <Path
          d="M4 7 Q24 20 44 7"
          stroke={isFemale ? '#D46070' : '#B04838'}
          strokeWidth="2" fill="none" strokeLinecap="round"
        />
      </Svg>
    </Animated.View>
  </Animated.View>
) : (
  /* Idle / thinking / listening — static smile */
  <G>
{/* Upper lip */}
<Path
  d="M68 138 Q90 133 112 138 Q104 137 90 139 Q76 137 68 138 Z"
  fill={isFemale ? '#C85060' : '#A04030'}
/>
{/* Smile curve */}
<Path
  d="M68 138 Q90 152 112 138"
  stroke={isFemale ? '#C85060' : '#A04030'}
  strokeWidth="2.5" fill="none" strokeLinecap="round"
/>
{/* Teeth */}
<Path
  d="M72 139 Q90 148 108 139 Q90 146 72 139 Z"
  fill="#F5EEE8" opacity="0.7"
/>
{/* Shine */}
<Ellipse cx="90" cy="144" rx="8" ry="2.5" fill="#FFF" opacity="0.18" />
  </G>
)}


{/* Smile dimples */}
<Ellipse cx="64"  cy="138" rx="3" ry="2" fill={skinShadow} opacity="0.28" />
<Ellipse cx="116" cy="138" rx="3" ry="2" fill={skinShadow} opacity="0.28" />
        </Svg>
      </Animated.View>

      {/* ── State feedback below avatar ───────────────────── */}
      <View style={styles.feedbackArea}>
        {isSpeaking  && <SoundBars color="#E67E22" fast />}
        {isListening && <SoundBars color="#2980B9" />}
        {isThinking  && <ThinkingDots />}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────
const AVATAR_SIZE = 200;

const styles = StyleSheet.create({
  outerWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: AVATAR_SIZE + 60,
  },
  avatarWrap: {
    alignItems: 'center',
  },
  // Halos
  halo: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2.5,
  },
  haloInner: {
    width:  AVATAR_SIZE + 10,
    height: AVATAR_SIZE + 10,
    top:  -5,
    left: 25,
  },
  haloOuter: {
    width:  AVATAR_SIZE + 40,
    height: AVATAR_SIZE + 40,
    top:  -20,
    left: 10,
  },
  haloGlow: {
    position: 'absolute',
    width:  AVATAR_SIZE + 10,
    height: AVATAR_SIZE + 10,
    top:  -5,
    left: 25,
    borderRadius: 9999,
  },
  feedbackArea: {
    height: 36,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#9B59B6',
  },
});

export default TourMateAvatar;
