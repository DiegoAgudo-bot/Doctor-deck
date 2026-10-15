import { router } from "expo-router";
import { Pressable, Text } from "react-native";
import { useSession } from "~/lib/auth";
import { colors } from "~/lib/theme";

/** Inicial del nombre de la cuenta (o del email). */
export function initialOf(name: string | null | undefined, email: string | null | undefined) {
  const source = (name ?? "").trim() || (email ?? "").trim();
  return (Array.from(source)[0] ?? "?").toLocaleUpperCase("es");
}

/** Botón redondo con la inicial de la cuenta, junto a la campana: abre el menú de la cuenta. */
export function AccountButton() {
  const { data: session } = useSession();
  const initial = initialOf(session?.user.name, session?.user.email);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Tu cuenta"
      hitSlop={8}
      onPress={() => router.push("/menu")}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.accent,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{initial}</Text>
    </Pressable>
  );
}
