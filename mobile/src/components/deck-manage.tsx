import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, Share, TextInput, View } from "react-native";
import { exportDeck, type ExportableDeck, type ExportFormat } from "@/domain/deck/export";
import { ROLE_TAGS } from "@/domain/roles/tags";
import type { AnalyzeResponse, DeckVersionDTO, DeckViewDTO } from "@/server/dto";
import { alert } from "~/components/dialog";
import { OptionRow, Sheet } from "~/components/sheet";
import { toast } from "~/components/toast";
import { Banner, Button, Chip, Field, Loading, styles, T } from "~/components/ui";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { colors } from "~/lib/theme";
import { intl, t } from "~/lib/i18n";

type Analysis = Extract<AnalyzeResponse, { status: "ok" }>;
type Visibility = DeckViewDTO["visibility"];

export const VISIBILITY: { key: Visibility; label: string; detail: string }[] = [
  {
    key: "public",
    label: t("Público", "Public"),
    detail: t(
      "Sale en tu perfil y en Comunidad, y avisa a quien te sigue.",
      "Shows on your profile and in Community, and notifies your followers.",
    ),
  },
  {
    key: "unlisted",
    label: t("Oculto", "Unlisted"),
    detail: t(
      "Solo quien tenga el enlace. No sale en tu perfil ni en Comunidad.",
      "Only people with the link. Not on your profile or in Community.",
    ),
  },
  {
    key: "private",
    label: t("Privado", "Private"),
    detail: t("Solo lo ves tú.", "Only you can see it."),
  },
];

const BRACKETS: { key: number | null; label: string }[] = [
  { key: null, label: t("Sin objetivo", "No target") },
  { key: 2, label: t("2 · Básico", "2 · Core") },
  { key: 3, label: t("3 · Mejorado", "3 · Upgraded") },
  { key: 4, label: t("4 · Optimizado", "4 · Optimized") },
];

/** Lo que cambia un mazo mío: nombre, visibilidad, bracket, tema, candados, lista… */
export function useDeckManage(deck: DeckViewDTO | undefined) {
  const qc = useQueryClient();
  const reload = () => {
    qc.invalidateQueries({ queryKey: ["deck", deck?.id] });
    qc.invalidateQueries({ queryKey: ["decks"] });
  };
  const patch = useMutation({
    mutationFn: (body: { name?: string; visibility?: Visibility; targetBracket?: number | null }) =>
      api(`/api/decks/${deck!.id}`, { method: "PATCH", body }),
    onSuccess: () => {
      tapFeedback();
      reload();
    },
    onError: (e) => toast(e.message),
  });
  /** Guarda el mazo con estos cambios (tema, candados, lista, comandantes). */
  const save = useMutation({
    mutationFn: (over: Partial<Pick<DeckViewDTO, "input" | "theme" | "locked" | "commanders">>) => {
      const d = { ...deck!, ...over };
      return api("/api/decks", {
        body: {
          id: d.id,
          name: d.name,
          input: d.input,
          commanders: d.commanders,
          locked: d.locked,
          excluded: d.excluded,
          ...(d.theme ? { theme: d.theme } : {}),
          ...(d.targetBracket ? { targetBracket: d.targetBracket } : {}),
        },
      });
    },
    onSuccess: reload,
    onError: (e) => toast(e.message),
  });
  const duplicate = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/decks", {
        body: {
          name: `${deck!.name} (${t("copia", "copy")})`,
          input: deck!.input,
          commanders: deck!.commanders,
          locked: deck!.locked,
          excluded: deck!.excluded,
          visibility: "private",
          ...(deck!.theme ? { theme: deck!.theme } : {}),
        },
      }),
    onSuccess: (r) => {
      toast(t("Copia guardada (privada)", "Copy saved (private)"));
      qc.invalidateQueries({ queryKey: ["decks"] });
      router.push(`/deck/${r.id}`);
    },
    onError: (e) => toast(e.message),
  });
  const remove = useMutation({
    mutationFn: () => api(`/api/decks/${deck!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast(t(`«${deck!.name}» borrado`, `“${deck!.name}” deleted`));
      qc.invalidateQueries({ queryKey: ["decks"] });
      qc.removeQueries({ queryKey: ["deck", deck!.id] });
    },
    onError: (e) => toast(e.message),
  });
  return { patch, save, duplicate, remove };
}

/**
 * Ajustes de un mazo mío (como en la web): nombre, visibilidad, bracket objetivo, historial,
 * reemplazar la lista, duplicar y borrar. Lo carga por su id (también desde la lista de mazos).
 */
export function DeckSettingsSheet({
  deckId,
  open,
  onClose,
  onDeleted,
}: {
  deckId: string;
  open: boolean;
  onClose: () => void;
  /** Tras borrarlo (p. ej. volver atrás si estaba abierto). */
  onDeleted?: () => void;
}) {
  const deck = useQuery({
    queryKey: ["deck", deckId],
    enabled: open,
    queryFn: () => api<DeckViewDTO>(`/api/decks/${deckId}`),
  });
  const d = deck.data;
  const m = useDeckManage(d);
  const [name, setName] = useState<string | null>(null);
  const [sub, setSub] = useState<"history" | "replace" | null>(null);

  const close = () => {
    setName(null);
    onClose();
  };
  const typed = name ?? d?.name ?? "";
  return (
    <>
      <Sheet
        open={open && sub === null}
        onClose={close}
        title={t("Ajustes del mazo", "Deck settings")}
      >
        {!d ? (
          <Loading />
        ) : (
          <View style={{ gap: 14 }}>
            <Field
              label={t("Nombre", "Name")}
              value={typed}
              onChangeText={setName}
              maxLength={120}
              returnKeyType="done"
            />
            {typed.trim() && typed.trim() !== d.name && (
              <Button
                label={t("Guardar el nombre", "Save name")}
                busy={m.patch.isPending}
                onPress={() =>
                  m.patch.mutate(
                    { name: typed.trim() },
                    {
                      onSuccess: () => {
                        setName(null);
                        toast(t("Nombre cambiado", "Name changed"));
                      },
                    },
                  )
                }
              />
            )}
            <View style={{ gap: 2 }}>
              <T variant="label">{t("Visibilidad", "Visibility")}</T>
              {VISIBILITY.map((v) => (
                <OptionRow
                  key={v.key}
                  label={v.label}
                  detail={v.detail}
                  selected={d.visibility === v.key}
                  disabled={m.patch.isPending}
                  onPress={() => m.patch.mutate({ visibility: v.key })}
                />
              ))}
            </View>
            <View style={{ gap: 6 }}>
              <T variant="label">{t("Bracket objetivo", "Target bracket")}</T>
              <T variant="small">
                {t(
                  "Los cambios sugeridos no suben el mazo por encima de este bracket.",
                  "Suggested changes don't take the deck above this bracket.",
                )}
              </T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {BRACKETS.map((b) => (
                  <Chip
                    key={String(b.key)}
                    label={b.label}
                    active={(d.targetBracket ?? null) === b.key}
                    onPress={() => m.patch.mutate({ targetBracket: b.key })}
                  />
                ))}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Button
                label={t("Historial de cambios", "Change history")}
                kind="secondary"
                icon="time-outline"
                onPress={() => setSub("history")}
              />
              <Button
                label={t("Reemplazar la lista", "Replace the list")}
                kind="secondary"
                icon="clipboard-outline"
                onPress={() => setSub("replace")}
              />
              <Button
                label={t("Duplicar", "Duplicate")}
                kind="secondary"
                icon="copy-outline"
                busy={m.duplicate.isPending}
                onPress={() => {
                  close();
                  m.duplicate.mutate();
                }}
              />
              <Button
                label={t("Borrar el mazo", "Delete the deck")}
                kind="danger"
                icon="trash-outline"
                onPress={() =>
                  alert(
                    t(`¿Borrar «${d.name}»?`, `Delete “${d.name}”?`),
                    t(
                      "Se borra para siempre, con su historial.",
                      "It's deleted forever, with its history.",
                    ),
                    [
                      { text: t("Cancelar", "Cancel"), style: "cancel" },
                      {
                        text: t("Borrar", "Delete"),
                        style: "destructive",
                        onPress: () =>
                          m.remove.mutate(undefined, {
                            onSuccess: () => {
                              close();
                              onDeleted?.();
                            },
                          }),
                      },
                    ],
                  )
                }
              />
            </View>
          </View>
        )}
      </Sheet>
      {d && (
        <>
          <HistorySheet deck={d} open={open && sub === "history"} onClose={() => setSub(null)} />
          <ReplaceSheet
            deck={d}
            open={open && sub === "replace"}
            onClose={() => setSub(null)}
            onDone={() => {
              setSub(null);
              close();
            }}
          />
        </>
      )}
    </>
  );
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(intl, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Versiones anteriores del mazo, con lo que entró y salió después de cada una, y restaurar. */
function HistorySheet({
  deck,
  open,
  onClose,
}: {
  deck: DeckViewDTO;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const versions = useQuery({
    queryKey: ["deck-versions", deck.id, deck.updatedAt],
    enabled: open,
    queryFn: () => api<DeckVersionDTO[]>(`/api/decks/${deck.id}/versions`),
  });
  const restore = useMutation({
    mutationFn: (v: DeckVersionDTO) =>
      api(`/api/decks/${deck.id}/versions/${v.id}`, { method: "POST" }),
    onSuccess: () => {
      tapFeedback();
      toast(
        t(
          "Versión restaurada (la de ahora queda en el historial)",
          "Version restored (the current one stays in the history)",
        ),
      );
      qc.invalidateQueries({ queryKey: ["deck", deck.id] });
      qc.invalidateQueries({ queryKey: ["decks"] });
      onClose();
    },
    onError: (e) => toast(e.message),
  });
  const list = versions.data ?? [];
  return (
    <Sheet open={open} onClose={onClose} title={t("Historial de cambios", "Change history")}>
      {versions.isPending ? (
        <Loading />
      ) : list.length === 0 ? (
        <T variant="muted">
          {t(
            "Todavía no hay versiones anteriores: se guarda una cada vez que cambia la lista.",
            "No previous versions yet: one is saved every time the list changes.",
          )}
        </T>
      ) : (
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 10 }}>
          {list.map((v) => (
            <View
              key={v.id}
              style={{ gap: 4, padding: 10, borderRadius: 8, backgroundColor: colors.panel }}
            >
              <T style={{ fontWeight: "700" }}>
                {when(v.createdAt)} · {v.cardCount} {t("cartas", "cards")}
              </T>
              {v.added.length > 0 && (
                <T variant="small" style={{ color: colors.in }}>
                  {t("Después entró:", "Then added:")}{" "}
                  {v.added.map((c) => `${c.copies > 1 ? `${c.copies} ` : ""}${c.name}`).join(", ")}
                </T>
              )}
              {v.removed.length > 0 && (
                <T variant="small" style={{ color: colors.out }}>
                  {t("Después salió:", "Then removed:")}{" "}
                  {v.removed
                    .map((c) => `${c.copies > 1 ? `${c.copies} ` : ""}${c.name}`)
                    .join(", ")}
                </T>
              )}
              <Button
                label={t("Volver a esta versión", "Go back to this version")}
                kind="ghost"
                onPress={() =>
                  alert(
                    t("¿Volver a esta versión?", "Go back to this version?"),
                    t(
                      "La lista de ahora se guarda en el historial, por si quieres recuperarla.",
                      "The current list is kept in the history, in case you want it back.",
                    ),
                    [
                      { text: t("Cancelar", "Cancel"), style: "cancel" },
                      { text: t("Volver", "Go back"), onPress: () => restore.mutate(v) },
                    ],
                  )
                }
              />
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

/** Pegar otra lista (o el enlace de un mazo público) en lugar de la que tiene. */
function ReplaceSheet({
  deck,
  open,
  onClose,
  onDone,
}: {
  deck: DeckViewDTO;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const m = useDeckManage(deck);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Reemplazar la lista", "Replace the list")}
      footer={
        <Button
          label={t("Reemplazar", "Replace")}
          disabled={!text.trim()}
          busy={m.save.isPending}
          onPress={() =>
            m.save.mutate(
              { input: text.trim(), locked: [] },
              {
                onSuccess: () => {
                  setText("");
                  toast(
                    t(
                      "Lista reemplazada (la anterior queda en el historial)",
                      "List replaced (the previous one stays in the history)",
                    ),
                  );
                  onDone();
                },
              },
            )
          }
        />
      }
    >
      <T variant="small">
        {t(
          "Pega la lista nueva (una carta por línea, con el comandante) o el enlace de un mazo público. La de ahora se guarda en el historial.",
          "Paste the new list (one card per line, with the commander) or the link to a public deck. The current one is kept in the history.",
        )}
      </T>
      <TextInput
        multiline
        value={text}
        onChangeText={setText}
        placeholder={"1 Sol Ring\n1 Arcane Signet\n…"}
        placeholderTextColor={colors.text3}
        textAlignVertical="top"
        style={[styles.field, { minHeight: 180, paddingTop: 10 }]}
      />
      {m.save.error && <Banner text={m.save.error.message} />}
    </Sheet>
  );
}

const FORMATS: { key: ExportFormat; label: string; hint: string }[] = [
  {
    key: "text",
    label: t("Texto", "Text"),
    hint: t(
      "Una carta por línea; lo leen casi todas las webs y apps de mazos.",
      "One card per line; almost every deck site and app reads it.",
    ),
  },
  {
    key: "arena",
    label: "MTG Arena",
    hint: t(
      "En Arena: Mazos › Importar. Solo entran las cartas que existen en Arena.",
      "In Arena: Decks › Import. Only cards that exist in Arena are included.",
    ),
  },
  {
    key: "mtgo",
    label: "MTGO",
    hint: t(
      "Para Magic Online: el comandante va en el banquillo.",
      "For Magic Online: the commander goes in the sideboard.",
    ),
  },
  {
    key: "moxfield",
    label: t("Con etiquetas", "With tags"),
    hint: t(
      "Con el rol de cada carta y tus etiquetas (#Ramp, #wincon); al importarlo aquí se leen igual.",
      "With each card's role and your tags (#Ramp, #wincon); importing it here reads them back.",
    ),
  },
];

/** La lista del análisis en el formato de `exportDeck` (como la web). */
export function exportableDeck(a: Analysis): ExportableDeck {
  return {
    commanders: a.commanders.map((c) => ({
      oracleId: c.oracleId,
      name: c.name,
      layout: c.layout,
      ...(c.printing ? { printing: c.printing } : {}),
      ...(c.foil ? { foil: true } : {}),
    })),
    cards: a.cards.map((c) => ({
      oracleId: c.card.oracleId,
      name: c.card.name,
      layout: c.card.layout,
      quantity: c.quantity,
      ...(c.card.printing ? { printing: c.card.printing } : {}),
      ...(c.card.foil ? { foil: true } : {}),
      tags: [
        ...(c.isBasicLand || c.primaryRole === "synergy" ? [] : [ROLE_TAGS[c.primaryRole]]),
        ...c.tags,
      ],
      // Las que venían en la lista: se conservan al reescribirla (cambiar una edición…).
      listTags: [
        ...(c.roleSource === "list"
          ? c.roles.filter((r) => r !== "synergy" && r !== "land").map((r) => ROLE_TAGS[r])
          : []),
        ...c.tags,
      ],
    })),
  };
}

/** Exportar la lista en texto, Arena, MTGO o con etiquetas, con «Compartir» del sistema. */
export function ExportSheet({
  name,
  analysis,
  open,
  onClose,
}: {
  name: string;
  analysis: Analysis | null;
  open: boolean;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<ExportFormat>("text");
  const text = analysis ? exportDeck(exportableDeck(analysis), format) : "";
  const f = FORMATS.find((x) => x.key === format)!;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Exportar", "Export")}
      footer={
        <Button
          label={t("Compartir o copiar", "Share or copy")}
          icon="share-outline"
          disabled={!text}
          onPress={() => Share.share({ title: name, message: text })}
        />
      }
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {FORMATS.map((x) => (
          <Chip
            key={x.key}
            label={x.label}
            active={format === x.key}
            onPress={() => setFormat(x.key)}
          />
        ))}
      </View>
      <T variant="small">{f.hint}</T>
      {analysis ? (
        <ScrollView
          style={{ maxHeight: 280, borderRadius: 8, backgroundColor: colors.panel }}
          contentContainerStyle={{ padding: 10 }}
        >
          <T variant="mono" selectable>
            {text}
          </T>
        </ScrollView>
      ) : (
        <Loading label={t("Analizando el mazo…", "Analyzing the deck…")} />
      )}
    </Sheet>
  );
}

/** Temas de la comunidad para el comandante («General» = sin tema). */
export function ThemePicker({
  themes,
  value,
  onChange,
  disabled,
}: {
  themes: { slug: string; name: string; count: number | null }[];
  value: string | null;
  onChange: (slug: string | null) => void;
  disabled?: boolean;
}) {
  if (themes.length === 0 && !value) return null;
  const top = themes.slice(0, 12);
  const shown =
    value && !top.some((t) => t.slug === value)
      ? [...top, themes.find((t) => t.slug === value) ?? { slug: value, name: value, count: null }]
      : top;
  return (
    <View style={{ gap: 6 }}>
      <T variant="label">{t("Tema", "Theme")}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Chip
            label="General"
            active={!value}
            onPress={() => !disabled && value && onChange(null)}
          />
          {shown.map((t) => (
            <Chip
              key={t.slug}
              label={t.name}
              active={value === t.slug}
              onPress={() => !disabled && value !== t.slug && onChange(t.slug)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
