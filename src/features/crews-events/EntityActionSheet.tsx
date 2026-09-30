import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";

import { NoxaButton, NoxaSurface } from "@/src/components/ui";
import { animations, colors, geometry, spacing } from "@/src/theme";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type EntityAction = {
  key: string;
  label: string;
  icon?: IoniconName;
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  actions: EntityAction[];
  onClose: () => void;
};

export function EntityActionSheet({ visible, title, actions, onClose }: Props) {
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const [rendered, setRendered] = useState(visible);
  const translateY = useRef(new Animated.Value(visible ? 0 : windowHeight)).current;
  const backdropOpacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const dragStartRef = useRef(0);
  const dismissingRef = useRef(false);

  const settleOpen = useCallback(() => {
    translateY.stopAnimation();
    backdropOpacity.stopAnimation();

    if (reduceMotion) {
      translateY.setValue(0);
      backdropOpacity.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        ...animations.spring.sheet,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: animations.micro,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, reduceMotion, translateY]);

  const animateOut = useCallback(
    (after?: () => void) => {
      if (dismissingRef.current) return;
      dismissingRef.current = true;
      translateY.stopAnimation();
      backdropOpacity.stopAnimation();

      const complete = () => {
        setRendered(false);
        dismissingRef.current = false;
        after?.();
      };

      if (reduceMotion) {
        translateY.setValue(windowHeight);
        backdropOpacity.setValue(0);
        complete();
        return;
      }

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: windowHeight,
          duration: animations.step,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: animations.micro,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) complete();
      });
    },
    [backdropOpacity, reduceMotion, translateY, windowHeight],
  );

  const requestClose = useCallback(
    (after?: () => void) => {
      animateOut(() => {
        onClose();
        after?.();
      });
    },
    [animateOut, onClose],
  );

  useEffect(() => {
    if (visible) {
      dismissingRef.current = false;
      translateY.setValue(reduceMotion ? 0 : windowHeight);
      backdropOpacity.setValue(reduceMotion ? 1 : 0);
      setRendered(true);
      return;
    }

    if (rendered && !dismissingRef.current) {
      animateOut();
    }
  }, [
    animateOut,
    backdropOpacity,
    reduceMotion,
    rendered,
    translateY,
    visible,
    windowHeight,
  ]);

  useEffect(() => {
    if (!rendered || !visible) return;
    settleOpen();
  }, [rendered, settleOpen, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          translateY.stopAnimation((value) => {
            dragStartRef.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          if (reduceMotion) return;
          translateY.setValue(Math.max(0, dragStartRef.current + gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          if (reduceMotion) {
            if (gesture.dy > 44 || gesture.vy > 0.7) requestClose();
            return;
          }

          if (gesture.dy > 72 || gesture.vy > 0.85) {
            requestClose();
            return;
          }

          Animated.spring(translateY, {
            toValue: 0,
            ...animations.spring.sheet,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          if (reduceMotion) {
            translateY.setValue(0);
            return;
          }

          Animated.spring(translateY, {
            toValue: 0,
            ...animations.spring.sheet,
            useNativeDriver: true,
          }).start();
        },
      }),
    [reduceMotion, requestClose, translateY],
  );

  const run = (action: EntityAction) => {
    if (action.disabled) return;
    requestClose(action.onPress);
  };

  return (
    <Modal
      animationType="none"
      onRequestClose={() => requestClose()}
      statusBarTranslucent
      transparent
      visible={rendered}>
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        />
        <Pressable
          accessibilityLabel="Close actions"
          accessibilityRole="button"
          onPress={() => requestClose()}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View
          style={[
            styles.motionLayer,
            {
              transform: [{ translateY }],
            },
          ]}>
          <NoxaSurface
            corners="top"
            cut={geometry.cut.lg}
            level="sheet"
            style={styles.sheet}>
            <View {...panResponder.panHandlers} style={styles.dragArea}>
              <View style={styles.handle} />
              <Text numberOfLines={1} style={styles.title}>
                {title}
              </Text>
            </View>

            <NoxaSurface
              corners="signature"
              level="content"
              maskChildren
              style={styles.actions}>
              {actions.map((action, index) => (
                <Pressable
                  key={action.key}
                  accessibilityRole="button"
                  disabled={action.disabled}
                  onPress={() => run(action)}
                  style={({ pressed }) => [
                    styles.row,
                    index < actions.length - 1 && styles.rowDivider,
                    pressed && !action.disabled && styles.pressed,
                    action.disabled && styles.disabled,
                  ]}>
                  <View style={styles.iconWrap}>
                    <Ionicons
                      name={action.icon ?? "ellipsis-horizontal"}
                      size={19}
                      color={action.destructive ? colors.primaryHover : colors.text}
                    />
                  </View>
                  <Text
                    style={[
                      styles.label,
                      action.destructive && styles.destructiveLabel,
                    ]}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </NoxaSurface>

            <NoxaButton
              fullWidth
              onPress={() => requestClose()}
              size="md"
              title="Cancel"
              variant="secondary"
            />
          </NoxaSurface>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  motionLayer: {
    width: "100%",
  },
  sheet: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  dragArea: {
    minHeight: 56,
    justifyContent: "center",
    paddingTop: spacing.xs,
  },
  handle: {
    width: 38,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  title: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  actions: {
    overflow: "hidden",
  },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: "transparent",
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  destructiveLabel: { color: colors.primaryHover },
  pressed: { opacity: animations.pressOpacity },
  disabled: { opacity: 0.4 },
});
