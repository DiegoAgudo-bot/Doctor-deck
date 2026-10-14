import { View } from "react-native";
import { colors, gem } from "~/lib/theme";

/** Franja con los cinco colores de la gema (como la de la web bajo la barra superior). */
export function GemStripe({ height = 2 }: { height?: number }) {
  return (
    <View style={{ flexDirection: "row", height }}>
      {gem.map((c) => (
        <View key={c} style={{ flex: 1, backgroundColor: c }} />
      ))}
    </View>
  );
}

/** Fondo de la cabecera de las pestañas: el panel con la franja de la gema abajo. */
export function GemHeaderBackground() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.panel, justifyContent: "flex-end" }}>
      <GemStripe />
    </View>
  );
}
