import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/src/theme";

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
  const run = (action: EntityAction) => {
    if (action.disabled) return;
    onClose();
    setTimeout(action.onPress, 120);
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="Close actions"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>

          <View style={styles.actions}>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                accessibilityRole="button"
                disabled={action.disabled}
                onPress={() => run(action)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && !action.disabled && styles.pressed,
                  action.disabled && styles.disabled,
                ]}
              >
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
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={styles.cancelText}>CANCEL</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.54)",
  },
  sheet: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
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
    marginBottom: spacing.sm,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  actions: {
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
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
  cancel: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "900",
    letterSpacing: 0.55,
  },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.4 },
});
