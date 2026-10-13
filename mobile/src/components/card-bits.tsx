import { Image } from "expo-image";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import { imageUri, smallImageUri } from "~/lib/api";
import { API_URL } from "~/lib/config";
import { colors, manaColors } from "~/lib/theme";

/** Proporción de una carta de Magic (63 × 88 mm). */
export const CARD_RATIO = 63 / 88;

/** Miniatura de la carta (imagen pequeña) o un hueco con el nombre si no hay imagen. */
export function CardThumb({
  uri,
  width,
  name,
  large,
  style,
}: {
  uri: string | null | undefined;
  width: number;
  name?: string;
  /** La imagen normal (ficha, rejilla grande) en vez de la pequeña. */
  large?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const src = large ? imageUri(uri) : smallImageUri(uri);
  const height = width / CARD_RATIO;
  const r = Math.max(4, width * 0.045);
  if (!src) {
    return (
      <View
        style={[
          {
            width,
            height,
            borderRadius: r,
            backgroundColor: colors.raised,
            alignItems: "center",
            justifyContent: "center",
            padding: 4,
          },
          style,
        ]}
      >
        <Text style={{ color: colors.text3, fontSize: 10, textAlign: "center" }} numberOfLines={3}>
          {name}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: src }}
      style={[{ width, height, borderRadius: r, backgroundColor: colors.raised }, style as object]}
      contentFit="cover"
      transition={120}
      cachePolicy="disk"
      recyclingKey={src}
      accessibilityLabel={name}
    />
  );
}

/** `{2}{U/B}{G}` → símbolos de maná (los SVG que sirve nuestro servidor). */
export function ManaCost({ cost, size = 14 }: { cost: string | null | undefined; size?: number }) {
  if (!cost) return null;
  const symbols = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => (m[1] ?? "").replace("/", ""));
  return (
    <View style={{ flexDirection: "row", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
      {symbols.map((s, i) =>
        s === "//" ? null : (
          <Image
            key={`${s}-${i}`}
            source={{ uri: `${API_URL}/symbols/${encodeURIComponent(s)}.svg` }}
            style={{ width: size, height: size }}
            cachePolicy="disk"
          />
        ),
      )}
    </View>
  );
}

/** Puntos de color de la identidad (W U B R G; incolora = C). */
export function ColorPips({
  colors: ids,
  size = 10,
}: {
  colors: readonly string[];
  size?: number;
}) {
  const list = ids.length > 0 ? ids : ["C"];
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {list.map((c) => (
        <View
          key={c}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: manaColors[c] ?? colors.text3,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.35)",
          }}
        />
      ))}
    </View>
  );
}

/** Estrella de foil, como en ManaBox. */
export const FoilMark = ({ size = 12 }: { size?: number }) => (
  <Text style={{ color: colors.foil, fontSize: size, fontWeight: "700" }}>★</Text>
);
