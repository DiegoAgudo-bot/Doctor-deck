import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { deviceLabel } from "@/domain/social/device-label";
import { SectionTitle } from "~/components/social";
import { toast } from "~/components/toast";
import { Banner, Button, Field, T } from "~/components/ui";
import { authClient, useSession } from "~/lib/auth";
import { colors, radius } from "~/lib/theme";

const PASSWORD_ERRORS: Record<string, string> = {
  INVALID_PASSWORD: "La contraseña actual no es correcta.",
  PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 8 caracteres.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
};

/** Cambiar la contraseña (solo si la cuenta tiene una; con Google no), cerrando las demás sesiones. */
export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  return (
    <View style={{ paddingHorizontal: 16, gap: 8 }}>
      {note && <Banner tone={note.tone} text={note.text} />}
      <Field
        label="Contraseña actual"
        value={current}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="current-password"
        onChangeText={setCurrent}
      />
      <Field
        label="Nueva (mínimo 8 caracteres)"
        value={next}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="new-password"
        onChangeText={setNext}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          label={show ? "Ocultar" : "Ver"}
          kind="ghost"
          icon={show ? "eye-off-outline" : "eye-outline"}
          onPress={() => setShow(!show)}
        />
        <View style={{ flex: 1 }}>
          <Button
            label="Cambiar la contraseña"
            busy={busy}
            disabled={current === "" || next.length < 8}
            onPress={async () => {
              setBusy(true);
              setNote(null);
              const { error } = await authClient.changePassword({
                currentPassword: current,
                newPassword: next,
                revokeOtherSessions: true,
              });
              setBusy(false);
              if (error) {
                setNote({
                  tone: "warn",
                  text:
                    (error.code && PASSWORD_ERRORS[error.code]) ||
                    (error.status === 429
                      ? "Demasiados intentos. Espera un minuto y vuelve a probar."
                      : "No se ha podido cambiar. Inténtalo de nuevo."),
                });
                return;
              }
              setCurrent("");
              setNext("");
              setNote({
                tone: "ok",
                text: "Contraseña cambiada. Se han cerrado tus sesiones en otros dispositivos.",
              });
            }}
          />
        </View>
      </View>
    </View>
  );
}

interface SessionRow {
  token: string;
  userAgent?: string | null | undefined;
  updatedAt: Date | string;
}

const lastSeen = (d: Date | string) =>
  new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

/** Dónde tengo la cuenta abierta, con cerrar una o todas las demás (como en la web). */
export function OpenSessions() {
  const { data: current } = useSession();
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => ((await authClient.listSessions()).data ?? []) as SessionRow[],
  });
  const [busy, setBusy] = useState(false);
  if (!current || !sessions.data) return null;
  const mine = current.session.token;
  const others = sessions.data
    .filter((s) => s.token !== mine)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const here = sessions.data.find((s) => s.token === mine);
  const rows = [...(here ? [here] : []), ...others];
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      toast("Sesión cerrada");
    } catch {
      toast("No se ha podido cerrar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
      void sessions.refetch();
    }
  };
  return (
    <>
      <SectionTitle
        right={
          others.length > 0 ? (
            <T
              variant="small"
              style={{ color: colors.accent }}
              onPress={busy ? undefined : () => void run(() => authClient.revokeOtherSessions())}
            >
              Cerrar las demás ({others.length})
            </T>
          ) : undefined
        }
      >
        Sesiones abiertas
      </SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 6 }}>
        {rows.map((s) => (
          <View
            key={s.token}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              padding: 10,
              borderRadius: radius.md,
              backgroundColor: colors.panel,
            }}
          >
            <View style={{ flex: 1 }}>
              <T>
                {deviceLabel(s.userAgent)}
                {s.token === mine && (
                  <T variant="small" style={{ color: colors.in }}>
                    {"  "}este dispositivo
                  </T>
                )}
              </T>
              <T variant="small">Última vez: {lastSeen(s.updatedAt)}</T>
            </View>
            {s.token !== mine && (
              <Button
                label="Cerrar"
                kind="ghost"
                disabled={busy}
                onPress={() => void run(() => authClient.revokeSession({ token: s.token }))}
              />
            )}
          </View>
        ))}
      </View>
    </>
  );
}
