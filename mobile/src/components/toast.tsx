import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radius } from "~/lib/theme";
import { T } from "./ui";

interface ToastData {
  id: number;
  text: string;
  action?: { label: string; onPress: () => void } | undefined;
}

let listener: ((t: ToastData) => void) | null = null;
let next = 1;

/**
 * Aviso corto abajo («Añadida a tu colección», «Cambio aplicado»), como los de ManaBox: no
 * interrumpe como un Alert y desaparece solo. Opcionalmente con una acción («Deshacer», «Ver»).
 */
export function toast(text: string, action?: ToastData["action"]) {
  listener?.({ id: next++, text, action });
}

/** Donde se pintan los avisos (una vez, en el layout raíz). */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<ToastData | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    listener = (t) => setCurrent(t);
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    const t = setTimeout(
      () => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
          setCurrent((c) => (c?.id === current.id ? null : c)),
        );
      },
      current.action ? 4500 : 2500,
    );
    return () => clearTimeout(t);
  }, [current, opacity]);

  if (!current) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 12,
        right: 12,
        bottom: insets.bottom + 72,
        opacity,
      }}
    >
      <View
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          backgroundColor: colors.text,
          borderRadius: radius.md,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <T style={{ flex: 1, color: colors.bg }}>{current.text}</T>
        {current.action && (
          <Pressable
            hitSlop={10}
            onPress={() => {
              current.action?.onPress();
              setCurrent(null);
            }}
          >
            <T style={{ color: colors.onAccent, fontWeight: "700" }}>{current.action.label}</T>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}
