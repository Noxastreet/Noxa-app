import { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';

const BACKGROUND = '#0A0A0A';
const ACCENT = '#C30D2A';
const TRACK = 'rgba(255,255,255,0.12)';
const SPLASH_DURATION = 3600;

const logoSource = require('../../assets/images/icon.png');

type NoxaSplashScreenProps = {
  onFinish: () => void;
  onLayoutReady: () => void;
};

export function NoxaSplashScreen({ onFinish, onLayoutReady }: NoxaSplashScreenProps) {
  const { width, height } = useWindowDimensions();
  const logoSize = Math.min(Math.max(width * 0.28, 104), 120);
  const progressWidth = Math.min(width * 0.42, 160);

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.72)).current;
  const logoTranslateY = useRef(new Animated.Value(24)).current;
  const progressOpacity = useRef(new Animated.Value(0)).current;
  const progressScaleX = useRef(new Animated.Value(0)).current;
  const rootOpacity = useRef(new Animated.Value(1)).current;

  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const hasStartedRef = useRef(false);
  const hasFinishedRef = useRef(false);

  const finishOnce = useCallback(() => {
    if (hasFinishedRef.current) {
      return;
    }

    hasFinishedRef.current = true;
    onFinish();
  }, [onFinish]);

  const startAnimation = useCallback(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    const premiumEase = Easing.bezier(0.16, 1, 0.3, 1);

    animationRef.current = Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 900,
          easing: premiumEase,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 900,
          easing: premiumEase,
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 900,
          easing: premiumEase,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(progressOpacity, {
          toValue: 1,
          duration: 450,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(progressScaleX, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(rootOpacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    animationRef.current.start(({ finished }) => {
      if (finished) {
        finishOnce();
      }
    });
  }, [finishOnce, logoOpacity, logoScale, logoTranslateY, progressOpacity, progressScaleX, rootOpacity]);

  const handleLayout = useCallback(
    (_event: LayoutChangeEvent) => {
      onLayoutReady();
      startAnimation();
    },
    [onLayoutReady, startAnimation],
  );

  useEffect(() => {
    const timeout = setTimeout(finishOnce, SPLASH_DURATION + 500);

    return () => {
      clearTimeout(timeout);
      animationRef.current?.stop();
    };
  }, [finishOnce]);

  const progressTranslateX = progressScaleX.interpolate({
    inputRange: [0, 1],
    outputRange: [-progressWidth / 2, 0],
  });

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[styles.root, { minHeight: height, opacity: rootOpacity }]}
    >
      <View style={styles.vignette} pointerEvents="none" />

      <Animated.View
        style={[
          styles.logoContainer,
          {
            width: logoSize,
            height: logoSize,
            borderRadius: logoSize * 0.215,
            opacity: logoOpacity,
            transform: [{ translateY: logoTranslateY }, { scale: logoScale }],
          },
        ]}
      >
        <Image source={logoSource} resizeMode="cover" style={styles.logoImage} />
      </Animated.View>

      <Animated.View
        style={[
          styles.progressArea,
          {
            bottom: Math.max(48, height * 0.065),
            width: progressWidth,
            marginLeft: -progressWidth / 2,
            opacity: progressOpacity,
          },
        ]}
      >
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.progress,
              {
                transform: [
                  { translateX: progressTranslateX },
                  { scaleX: progressScaleX },
                ],
              },
            ]}
          />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

export default NoxaSplashScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BACKGROUND,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(195,13,42,0.035)',
  },
  logoContainer: {
    overflow: 'hidden',
    backgroundColor: '#C8102E',
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  progressArea: {
    position: 'absolute',
    left: '50%',
  },
  track: {
    width: '100%',
    height: 3,
    overflow: 'hidden',
    borderRadius: 99,
    backgroundColor: TRACK,
  },
  progress: {
    width: '100%',
    height: '100%',
    borderRadius: 99,
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
});
