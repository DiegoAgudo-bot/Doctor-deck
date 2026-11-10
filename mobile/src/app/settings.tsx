import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reloadAppAsync } from "expo";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import {
  NOTIFICATION_GROUP_KEYS,
  notificationGroupLabel,
} from "@/domain/social/notification-prefs";
import type { AppInfoDTO, MyProfileDTO } from "@/server/dto";
import type { MemberDTO } from "@/server/social-dto";
import { ChangePassword, OpenSessions } from "~/components/account-security";
import { Sheet } from "~/components/sheet";
import { Card, PersonRow, SectionTitle, SwitchRow } from "~/components/social";
import { toast } from "~/components/toast";
import { Banner, Button, Chip, ErrorView, Field, Loading, MenuRow, T } from "~/components/ui";
import { alert } from "~/components/dialog";
import { api } from "~/lib/api";
import { langPref, saveBootPrefs, themePref, type LangPref, type ThemePref } from "~/lib/boot";
import { authClient, useSession } from "~/lib/auth";
import { API_URL } from "~/lib/config";
import { downloadAndShare } from "~/lib/download";
import { unregisterPush } from "~/lib/push";
import { clearCache } from "~/lib/query";
import { colors } from "~/lib/theme";
import { locale, t } from "~/lib/i18n";

const ALERT_OPTIONS: (number | null)[] = [null, 10, 15, 25, 40];

const THEMES: [ThemePref, string][] = [
  ["dark", t("Oscuro", "Dark")],
  ["light", t("Claro", "Light")],
  ["system", t("El del móvil", "Phone's")],
];
const LANGS: [LangPref, string][] = [
  ["auto", t("El del móvil", "Phone's")],
  ["es", "Español"],
  ["en", "English"],
];

/**
 * Tema e idioma elegidos a mano. Los colores y los textos se fijan al arrancar, así que al
 * cambiarlos la app se recarga (se avisa antes).
 */
function Appearance() {
  const change = (prefs: { lang?: LangPref; theme?: ThemePref }) =>
    alert(
      t("La app se va a recargar", "The app will reload"),
      t(
        "Para aplicar el cambio hay que volver a cargar la app. Tarda un momento.",
        "The app needs to reload to apply the change. It only takes a moment.",
      ),
      [
        { text: t("Cancelar", "Cancel"), style: "cancel" },
        {
          text: t("Cambiar", "Change"),
          onPress: () => {
            saveBootPrefs(prefs);
            reloadAppAsync().catch(() =>
              toast(
                t(
                  "Cierra la app y vuelve a abrirla para ver el cambio.",
                  "Close the app and open it again to see the change.",
                ),
              ),
            );
          },
        },
      ],
    );
  return (
    <>
      <SectionTitle>{t("Aspecto e idioma", "Appearance and language")}</SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <T variant="label">{t("Tema", "Theme")}</T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {THEMES.map(([key, label]) => (
            <Chip
              key={key}
              label={label}
              active={themePref === key}
              onPress={() => themePref !== key && change({ theme: key })}
            />
          ))}
        </View>
        <T variant="label" style={{ marginTop: 6 }}>
          {t("Idioma", "Language")}
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {LANGS.map(([key, label]) => (
            <Chip
              key={key}
              label={label}
              active={langPref === key}
              onPress={() => langPref !== key && change({ lang: key })}
            />
          ))}
        </View>
      </View>
    </>
  );
}

/**
 * Ajustes: cuenta (contraseña y sesiones), perfil público, privacidad, avisos, bloqueados y mis
 * datos.
 */
export default function Settings() {
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["me"],
    queryFn: () => api<MyProfileDTO>("/api/me/profile"),
  });
  const [username, setUsername] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (profile.data) setUsername(profile.data.username);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: (changes: Partial<MyProfileDTO>) =>
      api<MyProfileDTO>("/api/me/profile", { method: "PATCH", body: changes }),
    onSuccess: (p) => {
      qc.setQueryData(["me"], p);
      setUsername(p.username);
      toast(t("Guardado", "Saved"));
    },
    onError: (e) => toast(e.message),
  });

  const download = async (kind: "data" | "csv") => {
    setBusy(kind);
    const date = new Date().toISOString().slice(0, 10);
    try {
      if (kind === "data") {
        await downloadAndShare(
          "/api/me/export",
          t(`doctor-deck-mis-datos-${date}.json`, `doctor-deck-my-data-${date}.json`),
          "application/json",
        );
      } else {
        await downloadAndShare(
          "/api/collection/export",
          `doctor-deck-coleccion-${date}.csv`,
          "text/csv",
        );
      }
    } catch {
      toast(
        t(
          "No se ha podido descargar. Comprueba la conexión.",
          "Couldn't download it. Check your connection.",
        ),
      );
    } finally {
      setBusy(null);
    }
  };

  if (profile.isPending) return <Loading />;
  if (profile.isError) return <ErrorView error={profile.error} onRetry={() => profile.refetch()} />;
  const me = profile.data;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <AccountSection />

      <SectionTitle
        right={
          <T
            variant="small"
            style={{ color: colors.accent }}
            onPress={() => router.push(`/u/${me.username}`)}
          >
            {t("Ver mi perfil", "See my profile")}
          </T>
        }
      >
        {t("Perfil público", "Public profile")}
      </SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <Field
          label={t("Nombre de usuario", "Username")}
          value={username}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          onChangeText={(v) => setUsername(v.toLowerCase())}
        />
        <T variant="small">
          {t(
            `Tu perfil es doctordeck.app/u/${username || "…"}. De 3 a 20 letras, números o guion bajo, empezando por una letra.`,
            `Your profile is doctordeck.app/u/${username || "…"}. 3 to 20 letters, numbers or underscores, starting with a letter.`,
          )}
        </T>
        {username !== me.username && (
          <Button
            label={t("Guardar nombre de usuario", "Save username")}
            busy={save.isPending}
            disabled={username.trim().length < 3}
            onPress={() => save.mutate({ username: username.trim() })}
          />
        )}
      </View>
      <SwitchRow
        label={t("Colección pública", "Public collection")}
        detail={t(
          "Cualquiera puede verla en tu perfil (nunca a quién prestas ni en qué mazos está).",
          "Anyone can see it on your profile (never who you lend to or which decks it's in).",
        )}
        value={me.collectionPublic}
        disabled={save.isPending}
        onChange={(v) => save.mutate({ collectionPublic: v })}
      />
      <SwitchRow
        label={t("Listas de intercambio públicas", "Public trade lists")}
        detail={t(
          "Tu lista de deseos y lo que tienes para cambiar salen en tu perfil y en los cruces de otros.",
          "Your wishlist and what you have for trade show on your profile and in other people's matches.",
        )}
        value={me.tradesPublic}
        disabled={save.isPending}
        onChange={(v) => save.mutate({ tradesPublic: v })}
      />

      <SectionTitle>{t("Avisos", "Notifications")}</SectionTitle>
      <T variant="small" style={{ paddingHorizontal: 16 }}>
        {t(
          "Los que desactives no te llegarán ni al móvil ni a la web.",
          "The ones you turn off won't reach you on your phone or on the web.",
        )}
      </T>
      {NOTIFICATION_GROUP_KEYS.map((g) => (
        <SwitchRow
          key={g}
          label={notificationGroupLabel(g, locale).label}
          {...(notificationGroupLabel(g, locale).hint
            ? { detail: notificationGroupLabel(g, locale).hint }
            : {})}
          value={!me.mutedNotifications.includes(g)}
          disabled={save.isPending}
          onChange={(on) =>
            save.mutate({
              mutedNotifications: on
                ? me.mutedNotifications.filter((x) => x !== g)
                : [...me.mutedNotifications, g],
            })
          }
        />
      ))}

      <SectionTitle>{t("Avisos de precio", "Price alerts")}</SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <T variant="small">
          {t(
            "Te avisamos si una carta que te falta para tus mazos baja este porcentaje respecto a su precio más alto de los 30 días anteriores (como mucho un aviso por carta a la semana).",
            "We notify you if a card you're missing for your decks drops this percentage from its highest price in the previous 30 days (at most one alert per card per week).",
          )}
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {ALERT_OPTIONS.map((p) => (
            <Chip
              key={String(p)}
              label={p === null ? t("No avisar", "Off") : `${p} %`}
              active={me.priceAlertPercent === p}
              onPress={() => save.mutate({ priceAlertPercent: p })}
            />
          ))}
        </View>
      </View>

      <Appearance />

      <BlockedUsers />

      <SectionTitle>{t("Tus datos", "Your data")}</SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <Button
          label={t("Descargar todos mis datos (JSON)", "Download all my data (JSON)")}
          kind="secondary"
          icon="download-outline"
          busy={busy === "data"}
          onPress={() => void download("data")}
        />
        <Button
          label={t("Exportar mi colección (CSV)", "Export my collection (CSV)")}
          kind="secondary"
          icon="document-text-outline"
          busy={busy === "csv"}
          onPress={() => void download("csv")}
        />
        <T variant="small">
          {t(
            "Tu perfil, colección, mazos, listas de intercambio, propuestas, correcciones de roles, grupos, partidas, préstamos y comentarios.",
            "Your profile, collection, decks, trade lists, proposals, role corrections, groups, games, loans and comments.",
          )}
        </T>
      </View>
      <MenuRow
        icon="document-text-outline"
        label={t("Política de privacidad", "Privacy policy")}
        onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy`)}
      />
      <MenuRow
        icon="information-circle-outline"
        label={t("Aviso legal", "Legal notice")}
        onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/legal`)}
      />
      <View style={{ padding: 16 }}>
        <Card style={{ borderColor: colors.out }}>
          <T style={{ fontWeight: "700" }}>{t("Borrar mi cuenta", "Delete my account")}</T>
          <T variant="small">
            {t(
              "Se borran para siempre tu colección, tus mazos, tus listas y tus propuestas. No se puede deshacer.",
              "Your collection, decks, lists and proposals are deleted forever. This can't be undone.",
            )}
          </T>
          <Button
            label={t("Borrar mi cuenta", "Delete my account")}
            kind="danger"
            icon="trash-outline"
            onPress={() => setDeleting(true)}
          />
        </Card>
      </View>
      <DeleteAccountSheet open={deleting} email={me.email} onClose={() => setDeleting(false)} />
    </ScrollView>
  );
}

/** Email (y verificarlo) y vincular Google. */
function AccountSection() {
  const { data: session, refetch } = useSession();
  const info = useQuery({
    queryKey: ["app-info"],
    queryFn: () => api<AppInfoDTO>("/api/app"),
    staleTime: 60 * 60_000,
  });
  const accounts = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await authClient.listAccounts()).data ?? [],
  });
  const [note, setNote] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!session) return null;
  const verified = session.user.emailVerified;
  const hasGoogle = (accounts.data ?? []).some((a) => a.providerId === "google");
  const hasPassword = (accounts.data ?? []).some((a) => a.providerId === "credential");

  return (
    <>
      <SectionTitle>{t("Cuenta", "Account")}</SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        {note && <Banner tone={note.tone} text={note.text} />}
        <T>
          {session.user.email}{" "}
          <T variant="small" style={{ color: verified ? colors.in : colors.warn }}>
            · {verified ? t("verificado", "verified") : t("sin verificar", "not verified")}
          </T>
        </T>
        {!verified && info.data?.passwordReset && (
          <Button
            label={t("Enviar enlace de verificación", "Send verification link")}
            kind="secondary"
            busy={busy}
            onPress={async () => {
              setBusy(true);
              const { error } = await authClient.sendVerificationEmail({
                email: session.user.email,
                callbackURL: "/settings",
              });
              setBusy(false);
              setNote(
                error
                  ? {
                      tone: "warn",
                      text: t(
                        "No se ha podido enviar el correo. Prueba más tarde.",
                        "Couldn't send the email. Try again later.",
                      ),
                    }
                  : {
                      tone: "ok",
                      text: t(
                        "Te hemos enviado un enlace para verificar el email.",
                        "We've sent you a link to verify your email.",
                      ),
                    },
              );
              void refetch();
            }}
          />
        )}
        {info.data?.google &&
          accounts.data &&
          (hasGoogle ? (
            <T variant="small" style={{ color: colors.in }}>
              {t(
                "Google vinculado: puedes entrar con Google.",
                "Google linked: you can sign in with Google.",
              )}
            </T>
          ) : (
            <Button
              label={t("Vincular Google", "Link Google")}
              kind="secondary"
              icon="logo-google"
              busy={busy}
              onPress={async () => {
                setBusy(true);
                const { error } = await authClient.linkSocial({
                  provider: "google",
                  callbackURL: "/settings",
                });
                setBusy(false);
                if (error) {
                  setNote({
                    tone: "warn",
                    text: t(
                      "No se ha podido vincular Google. Usa la cuenta de Google con el mismo email (y que no esté ya vinculada a otro usuario).",
                      "Couldn't link Google. Use the Google account with the same email (and not already linked to another user).",
                    ),
                  });
                } else {
                  void accounts.refetch();
                }
              }}
            />
          ))}
      </View>
      {hasPassword && (
        <>
          <SectionTitle>{t("Cambiar la contraseña", "Change password")}</SectionTitle>
          <ChangePassword />
        </>
      )}
      <OpenSessions />
    </>
  );
}

function BlockedUsers() {
  const blocks = useQuery({
    queryKey: ["blocks"],
    queryFn: () => api<(MemberDTO & { blockedAt: string })[]>("/api/me/blocks"),
  });
  const unblock = useMutation({
    mutationFn: (username: string) => api(`/api/users/${username}/block`, { method: "DELETE" }),
    onSuccess: (_r, u) => {
      toast(t(`Has desbloqueado a @${u}`, `You unblocked @${u}`));
      blocks.refetch();
    },
    onError: (e) => toast(e.message),
  });
  if (!blocks.data || blocks.data.length === 0) return null;
  return (
    <>
      <SectionTitle>{t("Bloqueados", "Blocked")}</SectionTitle>
      {blocks.data.map((m) => (
        <PersonRow
          key={m.username ?? m.name}
          person={m}
          right={
            m.username ? (
              <Button
                label={t("Desbloquear", "Unblock")}
                kind="ghost"
                onPress={() => unblock.mutate(m.username!)}
              />
            ) : undefined
          }
        />
      ))}
    </>
  );
}

function DeleteAccountSheet({
  open,
  email,
  onClose,
}: {
  open: boolean;
  email: string;
  onClose: () => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const remove = useMutation({
    mutationFn: () =>
      api("/api/me", {
        method: "DELETE",
        body: { confirm: confirm.trim(), ...(password ? { password } : {}) },
      }),
    onSuccess: async () => {
      await unregisterPush();
      await authClient.signOut().catch(() => {});
      await clearCache();
    },
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Borrar mi cuenta", "Delete my account")}
      footer={
        <Button
          label={t("Borrar para siempre", "Delete forever")}
          kind="danger"
          busy={remove.isPending}
          disabled={confirm.trim().toLowerCase() !== email.toLowerCase()}
          onPress={() => remove.mutate()}
        />
      }
    >
      {remove.isError && <Banner text={remove.error.message} />}
      <T variant="small">
        {t(
          "Se borran tu colección, tus mazos, tus listas, tus propuestas, tus grupos y todo lo demás. No se puede deshacer. Escribe tu email para confirmarlo.",
          "Your collection, decks, lists, proposals, groups and everything else are deleted. This can't be undone. Type your email to confirm.",
        )}
      </T>
      <Field
        label={t("Tu email", "Your email")}
        placeholder={email}
        value={confirm}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={setConfirm}
      />
      <Field
        label={t(
          "Contraseña (si entras con Google, déjala vacía)",
          "Password (leave it empty if you sign in with Google)",
        )}
        value={password}
        secureTextEntry
        onChangeText={setPassword}
      />
    </Sheet>
  );
}
