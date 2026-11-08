import { useEffect, useRef } from "react";
import { Animated, Easing, ScrollView, View, type ViewStyle } from "react-native";
import { colors, radius } from "~/lib/theme";
import { CARD_RATIO } from "./card-bits";

/** Opacidad que va y viene (0,45 ↔ 1), compartida por todas las piezas de un esqueleto. */
function usePulse() {
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0.45,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return v;
}

const block = (style: ViewStyle): ViewStyle => ({
  backgroundColor: colors.raised,
  borderRadius: radius.sm,
  ...style,
});

/**
 * Resultados «sombreados» mientras llega una búsqueda: rejilla de cartas (`columns` por fila, con
 * el precio debajo) o lista (miniatura + dos líneas). Mismo tamaño que los resultados de verdad,
 * para que nada salte al llegar.
 */
export function ResultsSkeleton({
  columns,
  tile,
  rows = 4,
  footer = 1,
}: {
  /** 1 = lista; 2 o más = rejilla. */
  columns: number;
  /** Ancho de cada carta en la rejilla. */
  tile: number;
  rows?: number;
  /** Líneas de texto bajo cada carta de la rejilla. */
  footer?: number;
}) {
  const opacity = usePulse();
  return (
    <ScrollView
      scrollEnabled={false}
      contentContainerStyle={{ padding: 16, gap: columns > 1 ? 8 : 0 }}
      accessibilityLabel="…"
      accessibilityState={{ busy: true }}
    >
      <Animated.View style={{ opacity, gap: columns > 1 ? 12 : 0 }}>
        {Array.from({ length: rows }, (_, r) =>
          columns > 1 ? (
            <View key={r} style={{ flexDirection: "row", gap: 8 }}>
              {Array.from({ length: columns }, (_, c) => (
                <View key={c} style={{ width: tile, gap: 6, alignItems: "center" }}>
                  <View
                    style={block({
                      width: tile,
                      height: tile / CARD_RATIO,
                      borderRadius: Math.max(4, tile * 0.045),
                    })}
                  />
                  {Array.from({ length: footer }, (_, f) => (
                    <View
                      key={f}
                      style={block({ width: tile * (f === 0 ? 0.45 : 0.7), height: 12 })}
                    />
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <View
              key={r}
              style={{
                flexDirection: "row",
                gap: 12,
                paddingVertical: 8,
                alignItems: "center",
                borderBottomWidth: 1,
                borderBottomColor: colors.line,
              }}
            >
              <View style={block({ width: 44, height: 44 / CARD_RATIO, borderRadius: 4 })} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={block({ width: `${55 + ((r * 17) % 35)}%`, height: 14 })} />
                <View style={block({ width: "35%", height: 11 })} />
              </View>
              <View style={block({ width: 44, height: 14 })} />
            </View>
          ),
        )}
      </Animated.View>
    </ScrollView>
  );
}
