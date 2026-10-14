import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import type { AppInfoDTO, MyProfileDTO } from "@/server/dto";
import type { MemberDTO } from "@/server/social-dto";
import { Sheet } from "~/components/sheet";
import { Card, PersonRow, SectionTitle, SwitchRow } from "~/components/social";
import { toast } from "~/components/toast";
import { Banner, Button, Chip, ErrorView, Field, Loading, MenuRow, T } from "~/components/ui";
import { api } from "~/lib/api";
import { authClient, useSession } from "~/lib/auth";
import { API_URL } from "~/lib/config";
import { downloadAndShare } from "~/lib/download";
import { unregisterPush } from "~/lib/push";
import { clearCache } from "~/lib/query";
import { colors } from "~/lib/theme";

const ALERT_OPTIONS: (number | null)[] = [null, 10, 15, 25, 40];

/** Ajustes: cuenta, perfil público, privacidad, avisos de precio, bloqueados y mis datos. */
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
      toast("Guardado");
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
          `doctor-deck-mis-datos-${date}.json`,
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
      toast("No se ha podido descargar. Comprueba la conexión.");
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
            Ver mi perfil
          </T>
        }
      >
        Perfil público
      </SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <Field
          label="Nombre de usuario"
          value={username}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
          onChangeText={(v) => setUsername(v.toLowerCase())}
        />
        <T variant="small">
          Tu perfil es doctordeck.app/u/{username || "…"}. De 3 a 20 letras, números o guion bajo,
          empezando por una letra.
        </T>
        {username !== me.username && (
          <Button
            label="Guardar nombre de usuario"
            busy={save.isPending}
            disabled={username.trim().length < 3}
            onPress={() => save.mutate({ username: username.trim() })}
          />
        )}
      </View>
      <SwitchRow
        label="Colección pública"
        detail="Cualquiera puede verla en tu perfil (nunca a quién prestas ni en qué mazos está)."
        value={me.collectionPublic}
        disabled={save.isPending}
        onChange={(v) => save.mutate({ collectionPublic: v })}
      />
      <SwitchRow
        label="Listas de intercambio públicas"
        detail="Tu lista de deseos y lo que tienes para cambiar salen en tu perfil y en los cruces de otros."
        value={me.tradesPublic}
        disabled={save.isPending}
        onChange={(v) => save.mutate({ tradesPublic: v })}
      />

      <SectionTitle>Avisos de precio</SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <T variant="small">
          Te avisamos si una carta que te falta para tus mazos baja este porcentaje respecto a su
          precio más alto de los 30 días anteriores (como mucho un aviso por carta a la semana).
        </T>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {ALERT_OPTIONS.map((p) => (
            <Chip
              key={String(p)}
              label={p === null ? "No avisar" : `${p} %`}
              active={me.priceAlertPercent === p}
              onPress={() => save.mutate({ priceAlertPercent: p })}
            />
          ))}
        </View>
      </View>

      <BlockedUsers />

      <SectionTitle>Tus datos</SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <Button
          label="Descargar todos mis datos (JSON)"
          kind="secondary"
          icon="download-outline"
          busy={busy === "data"}
          onPress={() => void download("data")}
        />
        <Button
          label="Exportar mi colección (CSV)"
          kind="secondary"
          icon="document-text-outline"
          busy={busy === "csv"}
          onPress={() => void download("csv")}
        />
        <T variant="small">
          Tu perfil, colección, mazos, listas de intercambio, propuestas, correcciones de roles,
          grupos, partidas, préstamos y comentarios.
        </T>
      </View>
      <MenuRow
        icon="document-text-outline"
        label="Política de privacidad"
        onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/privacy`)}
      />
      <MenuRow
        icon="information-circle-outline"
        label="Aviso legal"
        onPress={() => WebBrowser.openBrowserAsync(`${API_URL}/legal`)}
      />
      <View style={{ padding: 16 }}>
        <Card style={{ borderColor: colors.out }}>
          <T style={{ fontWeight: "700" }}>Borrar mi cuenta</T>
          <T variant="small">
            Se borran para siempre tu colección, tus mazos, tus listas y tus propuestas. No se puede
            deshacer.
          </T>
          <Button
            label="Borrar mi cuenta"
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

  return (
    <>
      <SectionTitle>Cuenta</SectionTitle>
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        {note && <Banner tone={note.tone} text={note.text} />}
        <T>
          {session.user.email}{" "}
          <T variant="small" style={{ color: verified ? colors.in : colors.warn }}>
            · {verified ? "verificado" : "sin verificar"}
          </T>
        </T>
        {!verified && info.data?.passwordReset && (
          <Button
            label="Enviar enlace de verificación"
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
                  ? { tone: "warn", text: "No se ha podido enviar el correo. Prueba más tarde." }
                  : { tone: "ok", text: "Te hemos enviado un enlace para verificar el email." },
              );
              void refetch();
            }}
          />
        )}
        {info.data?.google &&
          accounts.data &&
          (hasGoogle ? (
            <T variant="small" style={{ color: colors.in }}>
              Google vinculado: puedes entrar con Google.
            </T>
          ) : (
            <Button
              label="Vincular Google"
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
                    text: "No se ha podido vincular Google. Usa la cuenta de Google con el mismo email (y que no esté ya vinculada a otro usuario).",
                  });
                } else {
                  void accounts.refetch();
                }
              }}
            />
          ))}
      </View>
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
      toast(`Has desbloqueado a @${u}`);
      blocks.refetch();
    },
    onError: (e) => toast(e.message),
  });
  if (!blocks.data || blocks.data.length === 0) return null;
  return (
    <>
      <SectionTitle>Bloqueados</SectionTitle>
      {blocks.data.map((m) => (
        <PersonRow
          key={m.username ?? m.name}
          person={m}
          right={
            m.username ? (
              <Button
                label="Desbloquear"
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
      title="Borrar mi cuenta"
      footer={
        <Button
          label="Borrar para siempre"
          kind="danger"
          busy={remove.isPending}
          disabled={confirm.trim().toLowerCase() !== email.toLowerCase()}
          onPress={() => remove.mutate()}
        />
      }
    >
      {remove.isError && <Banner text={remove.error.message} />}
      <T variant="small">
        Se borran tu colección, tus mazos, tus listas, tus propuestas, tus grupos y todo lo demás.
        No se puede deshacer. Escribe tu email para confirmarlo.
      </T>
      <Field
        label="Tu email"
        placeholder={email}
        value={confirm}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        onChangeText={setConfirm}
      />
      <Field
        label="Contraseña (si entras con Google, déjala vacía)"
        value={password}
        secureTextEntry
        onChangeText={setPassword}
      />
    </Sheet>
  );
}
