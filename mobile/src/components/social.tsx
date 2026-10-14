import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Switch, View, type StyleProp, type ViewStyle } from "react-native";
import { imageUri } from "~/lib/api";
import { colors, radius } from "~/lib/theme";
import { T, type IconName } from "./ui";

/** Foto de la persona (la de Google) o su inicial. */
export function Avatar({
  name,
  image,
  size = 36,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  const uri = imageUri(image);
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        cachePolicy="disk"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.raised,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <T style={{ fontWeight: "700", fontSize: size * 0.42, color: colors.text2 }}>
        {(name.trim()[0] ?? "?").toUpperCase()}
      </T>
    </View>
  );
}

/** Fila con una persona (foto, nombre y @usuario); al tocarla abre su perfil. */
export function PersonRow({
  person,
  detail,
  right,
  onPress,
}: {
  person: { username: string | null; name: string; image?: string | null };
  detail?: string | undefined;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const open =
    onPress ?? (person.username ? () => router.push(`/u/${person.username}`) : undefined);
  return (
    <Pressable
      onPress={open}
      disabled={!open}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: pressed ? colors.hover : "transparent",
      })}
    >
      <Avatar name={person.name || person.username || "?"} image={person.image ?? null} />
      <View style={{ flex: 1 }}>
        <T numberOfLines={1}>{person.name || `@${person.username}`}</T>
        <T variant="small" numberOfLines={1}>
          {[person.username ? `@${person.username}` : null, detail].filter(Boolean).join(" · ")}
        </T>
      </View>
      {right}
    </Pressable>
  );
}

/** Título de una sección dentro de una pantalla. */
export function SectionTitle({
  children,
  right,
  style,
}: {
  children: ReactNode;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: 6,
          gap: 8,
        },
        style,
      ]}
    >
      <T variant="label" style={{ flex: 1 }}>
        {children}
      </T>
      {right}
    </View>
  );
}

/** Interruptor con texto (ajustes). */
export function SwitchRow({
  label,
  detail,
  value,
  onChange,
  disabled,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <T>{label}</T>
        {detail && <T variant="small">{detail}</T>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.accent, false: colors.lineStrong }}
        thumbColor={colors.text}
      />
    </View>
  );
}

/** Tarjeta con borde (bloques dentro de una pantalla). */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.panel,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.line,
          padding: 14,
          gap: 8,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Cifra con su etiqueta (perfil, grupo, balance de un intercambio). */
export function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <T variant="h2" style={tone ? { color: tone } : undefined}>
        {value}
      </T>
      <T variant="small" style={{ textAlign: "center" }}>
        {label}
      </T>
    </View>
  );
}

/** Icono con texto pequeño (metadatos de una fila). */
export function Meta({ icon, text, color }: { icon: IconName; text: string; color?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={13} color={color ?? colors.text3} />
      <T variant="small" style={color ? { color } : undefined}>
        {text}
      </T>
    </View>
  );
}
