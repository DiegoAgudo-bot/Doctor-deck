import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { deviceLabel } from "@/domain/social/device-label";
import { SectionTitle } from "~/components/social";
import { toast } from "~/components/toast";
import { Banner, Button, Field, T } from "~/components/ui";
import { authClient, useSession } from "~/lib/auth";
import { colors, radius } from "~/lib/theme";
import { intl, locale, t } from "~/lib/i18n";

const PASSWORD_ERRORS: Record<string, string> = {
  INVALID_PASSWORD: t(
    "La contraseña actual no es correcta.",
    "Your current password isn't correct.",
  ),
  PASSWORD_TOO_SHORT: t(
    "La contraseña debe tener al menos 8 caracteres.",
    "The password must have at least 8 characters.",
  ),
  PASSWORD_TOO_LONG: t("La contraseña es demasiado larga.", "The password is too long."),
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
        label={t("Contraseña actual", "Current password")}
        value={current}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="current-password"
        onChangeText={setCurrent}
      />
      <Field
        label={t("Nueva (mínimo 8 caracteres)", "New (at least 8 characters)")}
        value={next}
        secureTextEntry={!show}
        autoCapitalize="none"
        autoComplete="new-password"
        onChangeText={setNext}
      />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          label={show ? t("Ocultar", "Hide") : t("Ver", "Show")}
          kind="ghost"
          icon={show ? "eye-off-outline" : "eye-outline"}
          onPress={() => setShow(!show)}
        />
        <View style={{ flex: 1 }}>
          <Button
            label={t("Cambiar la contraseña", "Change password")}
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
                      ? t(
                          "Demasiados intentos. Espera un minuto y vuelve a probar.",
                          "Too many attempts. Wait a minute and try again.",
                        )
                      : t(
                          "No se ha podido cambiar. Inténtalo de nuevo.",
                          "Couldn't change it. Please try again.",
                        )),
                });
                return;
              }
              setCurrent("");
              setNext("");
              setNote({
                tone: "ok",
                text: t(
                  "Contraseña cambiada. Se han cerrado tus sesiones en otros dispositivos.",
                  "Password changed. Your sessions on other devices have been signed out.",
                ),
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
  new Date(d).toLocaleDateString(intl, { day: "numeric", month: "short", year: "numeric" });

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
              {t("Cerrar las demás", "Sign out the others")} ({others.length})
            </T>
          ) : undefined
        }
      >
        {t("Sesiones abiertas", "Open sessions")}
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
                {deviceLabel(s.userAgent, locale)}
                {s.token === mine && (
                  <T variant="small" style={{ color: colors.in }}>
                    {"  "}
                    {t("este dispositivo", "this device")}
                  </T>
                )}
              </T>
              <T variant="small">
                {t("Última vez", "Last seen")}: {lastSeen(s.updatedAt)}
              </T>
            </View>
            {s.token !== mine && (
              <Button
                label={t("Cerrar", "Sign out")}
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
