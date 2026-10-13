import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { colors } from "~/lib/theme";
import { T } from "./ui";

/** − 3 + (copias). */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const btn = (icon: "remove" | "add", next: number) => (
    <Pressable
      accessibilityLabel={icon === "add" ? "Una más" : "Una menos"}
      disabled={disabled || next < min || next > max}
      onPress={() => onChange(next)}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: pressed ? colors.hover : colors.raised,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled || next < min || next > max ? 0.4 : 1,
      })}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {btn("remove", value - 1)}
      <T style={{ minWidth: 24, textAlign: "center", fontWeight: "700" }}>{value}</T>
      {btn("add", value + 1)}
    </View>
  );
}
