import { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';

const BACKGROUND = '#080A0F';
const ACCENT = '#FF2A2A';
const TEXT = '#F4F4F5';

type NoxaSplashScreenProps = {
  onFinish: () => void;
  onLayoutReady: () => void;
};

function NoxaLogo({ size }: { size: number }) {
  const barWidth = Math.max(10, size * 0.14);
  const barHeight = size;
  const diagonalHeight = size * 1.16;

  return (
    <View style={[styles.logo, { width: size, height: size }]}> 
      <View style={[styles.logoAccent, styles.logoAccentLeft, { height: barHeight * 0.88 }]} />
      <View style={[styles.logoAccent, styles.logoAccentRight, { height: barHeight * 0.88 }]} />
      <View style={[styles.logoBar, styles.logoLeft, { width: barWidth, height: barHeight }]} />
      <View style={[styles.logoBar, styles.logoDiagonal, { width: barWidth, height: diagonalHeight }]} />
      <View style={[styles.logoBar, styles.logoRight, { width: barWidth, height: barHeight }]} />
    </View>
  );
}

export function NoxaSplashScreen({ onFinish, onLayoutReady }: NoxaSplashScreenProps) {
  const { width, height } = useWindowDimensions();
  const lineWidth = Math.min(width * 0.54, 260);
  const logoSize = Math.min(Math.max(width * 0.18, 68), 92);

  const lineOpacity = useRef(new Animated.Value(0)).current;
  const lineScaleX = useRef(new Animated.Value(0.05)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const glowScaleX = useRef(new Animated.Value(0.1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.88)).current;
  const logoTranslateY = useRef(new Animated.Value(12)).current;
  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordTranslateY = useRef(new Animated.Value(8)).current;
  const sloganOpacity = useRef(new Animated.Value(0)).current;
  const sloganTranslateY = useRef(new Animated.Value(5)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;
  const groupScale = useRef(new Animated.Value(1)).current;

  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const hasStartedRef = useRef(false);
  const hasFinishedRef = useRef(false);

  const finishOnce = useCallback(() => {
    if (hasFinishedRef.current) {
      return;
    }
    hasFinishedRef.current = true;
    console.log('[Splash] animation finished');
    onFinish();
  }, [onFinish]);

  const startAnimation = useCallback(() => {
    if (hasStartedRef.current) {
      return;
    }
    hasStartedRef.current = true;
    console.log('[Splash] animation started');

    const easeOut = Easing.out(Easing.cubic);
    animationRef.current = Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(lineOpacity, { toValue: 1, duration: 400, easing: easeOut, useNativeDriver: true }),
        Animated.timing(lineScaleX, { toValue: 1, duration: 400, easing: easeOut, useNativeDriver: true }),
        Animated.timing(glowOpacity, { toValue: 0.35, duration: 400, easing: easeOut, useNativeDriver: true }),
        Animated.timing(glowScaleX, { toValue: 1, duration: 400, easing: easeOut, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, easing: easeOut, useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 500, easing: easeOut, useNativeDriver: true }),
        Animated.timing(logoTranslateY, { toValue: 0, duration: 500, easing: easeOut, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(wordOpacity, { toValue: 1, duration: 500, easing: easeOut, useNativeDriver: true }),
        Animated.timing(wordTranslateY, { toValue: 0, duration: 500, easing: easeOut, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(sloganOpacity, { toValue: 1, duration: 400, easing: easeOut, useNativeDriver: true }),
        Animated.timing(sloganTranslateY, { toValue: 0, duration: 400, easing: easeOut, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(rootOpacity, { toValue: 0, duration: 400, easing: easeOut, useNativeDriver: true }),
        Animated.timing(groupScale, { toValue: 1.03, duration: 400, easing: easeOut, useNativeDriver: true }),
      ]),
    ]);

    animationRef.current.start(({ finished }) => {
      if (finished) {
        finishOnce();
      }
    });
  }, [finishOnce, glowOpacity, glowScaleX, groupScale, lineOpacity, lineScaleX, logoOpacity, logoScale, logoTranslateY, rootOpacity, sloganOpacity, sloganTranslateY, wordOpacity, wordTranslateY]);

  const handleLayout = useCallback((_event: LayoutChangeEvent) => {
    onLayoutReady();
    startAnimation();
  }, [onLayoutReady, startAnimation]);

  useEffect(() => {
    const timeout = setTimeout(finishOnce, 4000);

    return () => {
      clearTimeout(timeout);
      animationRef.current?.stop();
    };
  }, [finishOnce]);

  return (
    <Animated.View onLayout={handleLayout} style={[styles.root, { minHeight: height, opacity: rootOpacity }]}> 
      <Animated.View style={[styles.group, { transform: [{ translateY: -height * 0.045 }, { scale: groupScale }] }]}> 
        <Animated.View style={{ opacity: logoOpacity, transform: [{ translateY: logoTranslateY }, { scale: logoScale }] }}>
          <NoxaLogo size={logoSize} />
          <View style={[styles.reflection, { width: logoSize * 0.66 }]} />
        </Animated.View>

        <View style={[styles.lineStage, { width: lineWidth }]}> 
          <Animated.View style={[styles.glowWide, { opacity: glowOpacity, transform: [{ scaleX: glowScaleX }] }]} />
          <Animated.View style={[styles.glowCore, { opacity: glowOpacity, transform: [{ scaleX: glowScaleX }] }]} />
          <Animated.View style={[styles.redLine, { opacity: lineOpacity, transform: [{ scaleX: lineScaleX }] }]} />
        </View>

        <Animated.Text style={[styles.wordmark, { opacity: wordOpacity, transform: [{ translateY: wordTranslateY }] }]}>NOXA</Animated.Text>
        <Animated.Text style={[styles.slogan, { opacity: sloganOpacity, transform: [{ translateY: sloganTranslateY }] }]}>OWN THE NIGHT</Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

export default NoxaSplashScreen;

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BACKGROUND },
  group: { alignItems: 'center', justifyContent: 'center' },
  logo: { alignItems: 'center', justifyContent: 'center' },
  logoBar: { position: 'absolute', borderRadius: 2, backgroundColor: TEXT },
  logoLeft: { left: '18%', transform: [{ skewY: '-8deg' }] },
  logoRight: { right: '18%', transform: [{ skewY: '-8deg' }] },
  logoDiagonal: { transform: [{ rotate: '-27deg' }, { skewY: '-6deg' }] },
  logoAccent: { position: 'absolute', top: '6%', width: 2, borderRadius: 2, backgroundColor: ACCENT, opacity: 0.9 },
  logoAccentLeft: { left: '13%' },
  logoAccentRight: { right: '13%' },
  reflection: { alignSelf: 'center', height: 2, marginTop: 12, borderRadius: 2, backgroundColor: 'rgba(255,42,42,0.28)' },
  lineStage: { height: 36, marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  glowWide: { position: 'absolute', width: '112%', height: 24, borderRadius: 24, backgroundColor: 'rgba(255,42,42,0.18)', shadowColor: ACCENT, shadowOpacity: 0.55, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
  glowCore: { position: 'absolute', width: '104%', height: 10, borderRadius: 10, backgroundColor: 'rgba(255,42,42,0.25)' },
  redLine: { width: '100%', height: 2, borderRadius: 2, backgroundColor: ACCENT },
  wordmark: { marginTop: 14, marginLeft: 8, color: TEXT, fontSize: 32, fontWeight: '600', letterSpacing: 10 },
  slogan: { marginTop: 10, marginLeft: 5, color: ACCENT, fontSize: 12, fontWeight: '700', letterSpacing: 5 },
});
