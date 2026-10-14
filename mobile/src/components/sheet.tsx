import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "~/lib/theme";
import { IconButton, T } from "./ui";

/**
 * Hoja que sube desde abajo (ordenar, filtros, añadir a un mazo…), como las de ManaBox. Se
 * cierra tocando fuera, con la X o con el botón «atrás» de Android.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityLabel="Cerrar"
          onPress={onClose}
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.55)" }}
        />
        <View
          style={{
            backgroundColor: colors.panel,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            maxHeight: "85%",
            paddingBottom: insets.bottom + 8,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: 8 }}>
            <View
              style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingLeft: 16,
              paddingRight: 8,
              paddingVertical: 6,
            }}
          >
            <T variant="h2" style={{ flex: 1 }} numberOfLines={1}>
              {title}
            </T>
            <IconButton icon="close" label="Cerrar" onPress={onClose} />
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
          {footer && <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 8 }}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Fila de opción para elegir dentro de una hoja (con marca si es la elegida). */
export function OptionRow({
  label,
  detail,
  selected,
  onPress,
  disabled,
  right,
}: {
  label: string;
  detail?: string | undefined;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  right?: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 48,
        paddingHorizontal: 12,
        borderRadius: radius.md,
        backgroundColor: pressed ? colors.hover : selected ? colors.raised : "transparent",
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <View style={{ flex: 1, paddingVertical: 8 }}>
        <T style={selected ? { fontWeight: "700" } : undefined}>{label}</T>
        {detail ? (
          <T variant="small" numberOfLines={1}>
            {detail}
          </T>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}
