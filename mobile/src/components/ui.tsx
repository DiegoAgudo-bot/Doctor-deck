import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, radius } from "~/lib/theme";

export type IconName = ComponentProps<typeof Ionicons>["name"];

/** Texto con los estilos de la app: `title`, `body` (por defecto), `small`, `muted`, `mono`. */
export function T({
  children,
  variant = "body",
  style,
  numberOfLines,
  onPress,
}: {
  children: ReactNode;
  variant?: "title" | "h2" | "body" | "small" | "muted" | "mono" | "label";
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  onPress?: () => void;
}) {
  return (
    <Text style={[styles[variant], style]} numberOfLines={numberOfLines} onPress={onPress}>
      {children}
    </Text>
  );
}

export function Button({
  label,
  onPress,
  icon,
  kind = "primary",
  disabled,
  busy,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  kind?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    kind === "primary"
      ? colors.accent
      : kind === "danger"
        ? colors.out
        : kind === "ghost"
          ? "transparent"
          : colors.raised;
  const fg = kind === "primary" ? colors.onAccent : kind === "danger" ? "#fff" : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        kind === "secondary" && { borderWidth: 1, borderColor: colors.lineStrong },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color = colors.text,
  size = 22,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

/** Botón redondo flotante abajo a la derecha (el «+» de la colección y los mazos, como en ManaBox). */
export function Fab({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        position: "absolute",
        right: 16,
        bottom: 16,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.85 : 1,
        elevation: 4,
        shadowColor: "#000",
        shadowOpacity: 0.3,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      })}
    >
      <Ionicons name={icon} size={28} color={colors.onAccent} />
    </Pressable>
  );
}

/** Pastilla seleccionable (filtros, orden) como las de ManaBox. */
export function Chip({
  label,
  active,
  onPress,
  icon,
  trailingIcon,
  accessibilityLabel,
}: {
  label: string;
  active?: boolean;
  onPress: () => void;
  icon?: IconName | undefined;
  /** Detrás del texto: `chevron-down` (abre una hoja) o `close` (quita el filtro). */
  trailingIcon?: IconName | undefined;
  accessibilityLabel?: string | undefined;
}) {
  const fg = active ? colors.onAccent : colors.text2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: colors.accent, borderColor: colors.accent },
        pressed && { opacity: 0.75 },
      ]}
    >
      {icon && <Ionicons name={icon} size={14} color={fg} />}
      <Text style={[styles.chipText, active && { color: colors.onAccent }]}>{label}</Text>
      {trailingIcon && <Ionicons name={trailingIcon} size={14} color={fg} />}
    </Pressable>
  );
}

export function SearchField(props: TextInputProps & { onClear?: () => void }) {
  const { onClear, style, ...rest } = props;
  return (
    <View style={[styles.search, style as StyleProp<ViewStyle>]}>
      <Ionicons name="search" size={18} color={colors.text3} />
      <TextInput
        placeholderTextColor={colors.text3}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={styles.searchInput}
        {...rest}
      />
      {onClear && rest.value ? (
        <IconButton
          icon="close-circle"
          label="Borrar"
          size={18}
          color={colors.text3}
          onPress={onClear}
        />
      ) : null}
    </View>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{label}</T>
      <TextInput placeholderTextColor={colors.text3} style={[styles.field, style]} {...rest} />
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      {label && <T variant="muted">{label}</T>}
    </View>
  );
}

export function Empty({
  icon,
  title,
  text,
  action,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={42} color={colors.text3} />
      <T variant="h2" style={{ textAlign: "center" }}>
        {title}
      </T>
      {text && (
        <T variant="muted" style={{ textAlign: "center" }}>
          {text}
        </T>
      )}
      {action}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Empty
      icon="cloud-offline-outline"
      title="No se ha podido cargar"
      text={error instanceof Error ? error.message : String(error)}
      action={
        onRetry ? <Button label="Reintentar" kind="secondary" onPress={onRetry} /> : undefined
      }
    />
  );
}

export function Banner({ text, tone = "warn" }: { text: string; tone?: "warn" | "info" | "ok" }) {
  const c = tone === "warn" ? colors.warn : tone === "ok" ? colors.in : colors.accent;
  return (
    <View style={[styles.banner, { borderColor: c }]}>
      <T variant="small" style={{ color: c }}>
        {text}
      </T>
    </View>
  );
}

/** Pestañas segmentadas (Lista / Me falta / Cambios…). */
export function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable
          key={o.key}
          onPress={() => onChange(o.key)}
          style={[styles.segment, o.key === value && { backgroundColor: colors.hover }]}
        >
          <Text
            style={[styles.segmentText, o.key === value && { color: colors.text }]}
            numberOfLines={1}
          >
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Fila de menú con icono y flecha (pantalla "Más", ajustes). */
export function MenuRow({
  icon,
  label,
  detail,
  onPress,
  danger,
}: {
  icon: IconName;
  label: string;
  detail?: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.hover }]}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.out : colors.accent} />
      <View style={{ flex: 1 }}>
        <T style={danger ? { color: colors.out } : undefined}>{label}</T>
        {detail && <T variant="small">{detail}</T>}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.text3} />
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  h2: { color: colors.text, fontSize: 17, fontWeight: "600" },
  body: { color: colors.text, fontSize: 15 },
  small: { color: colors.text2, fontSize: 13 },
  muted: { color: colors.text3, fontSize: 14 },
  mono: { color: colors.text2, fontSize: 13, fontVariant: ["tabular-nums"] },
  label: { color: colors.text2, fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  button: {
    minHeight: 46,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: { fontSize: 15, fontWeight: "600" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.panel,
  },
  chipText: { color: colors.text2, fontSize: 13, fontWeight: "500" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.raised,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 },
  field: {
    backgroundColor: colors.raised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    fontSize: 16,
    paddingHorizontal: 14,
    height: 48,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 32,
  },
  banner: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: 10,
    backgroundColor: colors.panel,
  },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.sm },
  segmentText: { color: colors.text3, fontSize: 13, fontWeight: "600" },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
});
