import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { exportDecklist, setPrinting } from "@/domain/deck/export";
import { ROLE_LABELS, ROLES, type Role } from "@/domain/roles/types";
import type { CatalogPageDTO } from "@/server/card-dto";
import type {
  AnalyzeResponse,
  CardDTO,
  DeckCardDTO,
  DeckViewDTO,
  OwnershipItemDTO,
  PrintingDTO,
} from "@/server/dto";
import { CardThumb } from "~/components/card-bits";
import { exportableDeck, useDeckManage } from "~/components/deck-manage";
import { OptionRow, Sheet } from "~/components/sheet";
import { toast } from "~/components/toast";
import { Banner, Button, Chip, Field, Loading, SearchField, T } from "~/components/ui";
import { api } from "~/lib/api";
import { tapFeedback } from "~/lib/feedback";
import { euros } from "~/lib/format";
import { useDebounced } from "~/lib/hooks";
import { colors, radius } from "~/lib/theme";
import { roleName, t } from "~/lib/i18n";

type Analysis = Extract<AnalyzeResponse, { status: "ok" }>;

const SOURCE_LABEL: Record<DeckCardDTO["roleSource"], string> = {
  auto: t("automáticos", "automatic"),
  list: t("de las etiquetas de la lista", "from the list's tags"),
  mine: t("corregidos por ti (todos tus mazos)", "corrected by you (all your decks)"),
  deck: t("corregidos por ti (solo este mazo)", "corrected by you (this deck only)"),
};

/** Cambiar copias del mazo (−1 quita, +1 añade): una petición, y se vuelve a pedir el mazo. */
export function useChangeCards(deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ card, delta }: { card: CardDTO; delta: number }) =>
      api(`/api/decks/${deckId}/cards`, {
        method: "PATCH",
        body: { changes: [{ oracleId: card.oracleId, delta }] },
      }),
    onSuccess: (_r, { card, delta }) => {
      tapFeedback();
      toast(
        delta > 0
          ? t(`Añadida ${card.name}`, `Added ${card.name}`)
          : t(`Quitada ${card.name}`, `Removed ${card.name}`),
      );
      qc.invalidateQueries({ queryKey: ["deck", deckId] });
      qc.invalidateQueries({ queryKey: ["decks"] });
    },
    onError: (e) => toast(e.message),
  });
}

/**
 * Añadir cartas al mazo: buscador limitado a la identidad del comandante y, sin escribir nada,
 * las recomendadas que tengo libres en mi colección (como «Añadir cartas» de la web).
 */
export function AddCardsSheet({
  deck,
  analysis: a,
  open,
  onClose,
}: {
  deck: DeckViewDTO;
  analysis: Analysis;
  open: boolean;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim());
  const change = useChangeCards(deck.id);
  const identity = [...new Set(a.commanders.flatMap((c) => c.colorIdentity))];
  const colorsParam = identity.length ? identity.join("") : "C";
  const inDeck = new Map(a.cards.map((c) => [c.card.oracleId, c]));
  const results = useQuery({
    queryKey: ["catalog", "deck-add", colorsParam, query],
    enabled: open && query.length > 1,
    queryFn: () =>
      api<CatalogPageDTO>(
        `/api/cards?q=${encodeURIComponent(query)}&colors=${colorsParam}&mode=within&limit=25`,
      ),
  });
  const mine = a.addCandidates.filter((c) => (c.available ?? 0) > 0).slice(0, 20);

  const row = (card: CardDTO, detail: string | null) => {
    const current = inDeck.get(card.oracleId);
    const full =
      current !== undefined && current.maxCopies !== null && current.quantity >= current.maxCopies;
    return (
      <View
        key={card.oracleId}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 }}
      >
        <CardThumb uri={card.imageUrl} width={34} name={card.name} />
        <View style={{ flex: 1 }}>
          <T numberOfLines={1}>{card.name}</T>
          <T variant="small" numberOfLines={1}>
            {current
              ? t(
                  `Ya en el mazo (${current.quantity})`,
                  `Already in the deck (${current.quantity})`,
                )
              : (detail ?? card.typeLine)}
          </T>
        </View>
        <Button
          label={t("Añadir", "Add")}
          kind={current ? "ghost" : "secondary"}
          icon="add"
          disabled={full || change.isPending}
          onPress={() => change.mutate({ card, delta: 1 })}
        />
      </View>
    );
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("Añadir cartas", "Add cards")}>
      <SearchField
        placeholder={t("Busca una carta de sus colores", "Search for a card in its colors")}
        value={q}
        onChangeText={setQ}
        onClear={() => setQ("")}
      />
      <ScrollView style={{ maxHeight: 440 }} keyboardShouldPersistTaps="handled">
        {query.length > 1 ? (
          results.isPending ? (
            <Loading />
          ) : (results.data?.items.length ?? 0) === 0 ? (
            <T variant="muted">
              {t(
                "Ninguna carta de sus colores se llama así.",
                "No card in its colors has that name.",
              )}
            </T>
          ) : (
            results.data!.items.map((c) =>
              row(c, c.price !== null ? `${c.typeLine} · ${euros(c.price)}` : c.typeLine),
            )
          )
        ) : mine.length === 0 ? (
          <T variant="muted">
            {t(
              "Escribe el nombre de una carta. Aquí saldrán también las recomendadas que tienes libres en tu colección.",
              "Type a card's name. The recommended cards you have spare in your collection will also show here.",
            )}
          </T>
        ) : (
          <View style={{ gap: 2 }}>
            <T variant="label">
              {t("Recomendadas de tu colección", "Recommended from your collection")}
            </T>
            {mine.map((s) =>
              row(
                s.card,
                `${roleName(s.primaryRole)}${
                  s.inclusion !== null
                    ? t(
                        ` · en el ${Math.round(s.inclusion * 100)} % de mazos`,
                        ` · in ${Math.round(s.inclusion * 100)}% of decks`,
                      )
                    : ""
                }`,
              ),
            )}
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

/**
 * Lo que se puede hacer con una carta de un mazo mío: copias −/+, su edición, sus roles y
 * etiquetas, ver la ficha y quitarla.
 */
export function CardActionsSheet({
  deck,
  analysis: a,
  card,
  onClose,
}: {
  deck: DeckViewDTO;
  analysis: Analysis;
  /** La carta del mazo (null = cerrada). */
  card: DeckCardDTO | null;
  onClose: () => void;
}) {
  const change = useChangeCards(deck.id);
  const [sub, setSub] = useState<"printing" | "roles" | null>(null);
  const close = () => {
    setSub(null);
    onClose();
  };
  if (!card) return null;
  const max = card.maxCopies;
  return (
    <>
      <Sheet open={sub === null} onClose={close} title={card.card.name}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <CardThumb uri={card.card.imageUrl} width={64} name={card.card.name} />
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="small" numberOfLines={2}>
              {card.card.typeLine}
            </T>
            {card.card.printing && (
              <T variant="small">
                {card.card.printing.setCode.toUpperCase()} · {card.card.printing.setName ?? ""} #
                {card.card.printing.collectorNumber}
              </T>
            )}
            <T variant="small">
              {card.roles.map((r) => roleName(r)).join(", ")} · {SOURCE_LABEL[card.roleSource]}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <T style={{ flex: 1 }}>
            {t("Copias en el mazo", "Copies in the deck")}
            {max !== null && max > 1 ? ` (${t("máx.", "max.")} ${max})` : ""}
          </T>
          <Button
            label="−"
            kind="secondary"
            disabled={change.isPending}
            onPress={() =>
              change.mutate(
                { card: card.card, delta: -1 },
                { onSuccess: () => card.quantity <= 1 && close() },
              )
            }
          />
          <T variant="mono" style={{ minWidth: 24, textAlign: "center" }}>
            {card.quantity}
          </T>
          <Button
            label="+"
            kind="secondary"
            disabled={change.isPending || (max !== null && card.quantity >= max)}
            onPress={() => change.mutate({ card: card.card, delta: 1 })}
          />
        </View>
        <View style={{ gap: 2 }}>
          <OptionRow
            label={t("Edición", "Printing")}
            detail={
              card.card.printing
                ? `${card.card.printing.setCode.toUpperCase()} #${card.card.printing.collectorNumber}`
                : t("La de por defecto", "Default")
            }
            onPress={() => setSub("printing")}
          />
          <OptionRow
            label={t("Roles y etiquetas", "Roles and tags")}
            detail={card.tags.length ? card.tags.map((t) => `#${t}`).join(" ") : undefined}
            onPress={() => setSub("roles")}
          />
          <OptionRow
            label={t("Ver la ficha", "See the card page")}
            onPress={() => {
              close();
              router.push(`/card/${card.card.oracleId}`);
            }}
          />
        </View>
        <Button
          label={
            card.quantity > 1
              ? t("Quitar todas las copias", "Remove all copies")
              : t("Quitar del mazo", "Remove from the deck")
          }
          kind="danger"
          icon="trash-outline"
          disabled={change.isPending}
          onPress={() =>
            change.mutate({ card: card.card, delta: -card.quantity }, { onSuccess: () => close() })
          }
        />
      </Sheet>
      <PrintingSheet
        deck={deck}
        analysis={a}
        card={card}
        open={sub === "printing"}
        onClose={() => setSub(null)}
      />
      <RolesSheet deck={deck} card={card} open={sub === "roles"} onClose={() => setSub(null)} />
    </>
  );
}

/** Elegir la edición de una carta del mazo: se reescribe la lista con `(SET) número`. */
function PrintingSheet({
  deck,
  analysis: a,
  card,
  open,
  onClose,
}: {
  deck: DeckViewDTO;
  analysis: Analysis;
  card: DeckCardDTO;
  open: boolean;
  onClose: () => void;
}) {
  const manage = useDeckManage(deck);
  const printings = useQuery({
    queryKey: ["printings", card.card.oracleId],
    enabled: open,
    staleTime: 60 * 60_000,
    queryFn: () => api<PrintingDTO[]>(`/api/cards/${card.card.oracleId}/printings`),
  });
  const pick = (p: PrintingDTO | null) => {
    const next = setPrinting(
      exportableDeck(a),
      card.card.oracleId,
      p ? { setCode: p.setCode, collectorNumber: p.collectorNumber } : null,
    );
    manage.save.mutate(
      { input: exportDecklist(next) },
      {
        onSuccess: () => {
          toast(
            p
              ? `${t("Edición", "Printing")}: ${p.setCode.toUpperCase()} #${p.collectorNumber}`
              : t("Edición por defecto", "Default printing"),
          );
          onClose();
        },
      },
    );
  };
  const current = card.card.printing;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t(`Edición de ${card.card.name}`, `Printing of ${card.card.name}`)}
    >
      {printings.isPending ? (
        <Loading />
      ) : (
        <ScrollView style={{ maxHeight: 460 }}>
          <OptionRow
            label={t("La de por defecto", "Default")}
            selected={!current}
            disabled={manage.save.isPending}
            onPress={() => pick(null)}
          />
          {(printings.data ?? []).map((p) => (
            <OptionRow
              key={p.scryfallId}
              label={`${p.setCode.toUpperCase()} #${p.collectorNumber} · ${p.setName ?? ""}`}
              detail={`${p.releasedAt?.slice(0, 4) ?? ""}  ·  ${euros(p.priceEur)}  ·  foil ${euros(p.priceEurFoil)}`}
              selected={
                current?.setCode === p.setCode && current.collectorNumber === p.collectorNumber
              }
              disabled={manage.save.isPending}
              onPress={() => pick(p)}
            />
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

/**
 * Corregir los roles y etiquetas de una carta: en todos mis mazos o solo en este. Sin nada
 * marcado vuelve a los automáticos.
 */
function RolesSheet({
  deck,
  card,
  open,
  onClose,
}: {
  deck: DeckViewDTO;
  card: DeckCardDTO;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [roles, setRoles] = useState<Role[]>(card.roles);
  const [primary, setPrimary] = useState<Role>(card.primaryRole);
  const [tags, setTags] = useState(card.tags.join(", "));
  const [scope, setScope] = useState<"mine" | "deck">(card.roleSource === "deck" ? "deck" : "mine");
  const save = useMutation({
    mutationFn: (body: { roles: Role[]; primary: Role | null; tags: string[] }) =>
      api(
        scope === "deck"
          ? `/api/decks/${deck.id}/card-roles/${card.card.oracleId}`
          : `/api/me/card-roles/${card.card.oracleId}`,
        { method: "PUT", body },
      ),
    onSuccess: () => {
      tapFeedback();
      toast(t("Roles guardados", "Roles saved"));
      qc.invalidateQueries({ queryKey: ["analysis", deck.id] });
      qc.invalidateQueries({ queryKey: ["collection"] });
      onClose();
    },
    onError: (e) => toast(e.message),
  });
  const toggle = (r: Role) => {
    const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r];
    setRoles(next);
    if (!next.includes(primary) && next[0]) setPrimary(next[0]);
  };
  const tagList = tags
    .split(/[,#]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 10);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t(`Roles de ${card.card.name}`, `Roles of ${card.card.name}`)}
      footer={
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            label={t("Automáticos", "Automatic")}
            kind="secondary"
            disabled={save.isPending}
            onPress={() => save.mutate({ roles: [], primary: null, tags: [] })}
            style={{ flex: 1 }}
          />
          <Button
            label={t("Guardar", "Save")}
            busy={save.isPending}
            disabled={roles.length === 0}
            onPress={() => save.mutate({ roles, primary, tags: tagList })}
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Chip
          label={t("En todos mis mazos", "In all my decks")}
          active={scope === "mine"}
          onPress={() => setScope("mine")}
        />
        <Chip
          label={t("Solo en este mazo", "Only in this deck")}
          active={scope === "deck"}
          onPress={() => setScope("deck")}
        />
      </View>
      <T variant="label">
        {t("Roles (toca el principal dos veces)", "Roles (tap the main one twice)")}
      </T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {ROLES.map((r) => (
          <Chip
            key={r}
            label={primary === r && roles.includes(r) ? `★ ${roleName(r)}` : roleName(r)}
            active={roles.includes(r)}
            onPress={() => (roles.includes(r) && primary !== r ? setPrimary(r) : toggle(r))}
          />
        ))}
      </View>
      <T variant="small">
        {t(
          "Marca los roles que cumple; la ★ es el principal (cuenta para los mínimos y los cambios).",
          "Mark the roles it fills; the ★ is the main one (it counts for minimums and changes).",
        )}
      </T>
      <Field
        label={t("Etiquetas (separadas por comas)", "Tags (comma-separated)")}
        value={tags}
        onChangeText={setTags}
        placeholder="wincon, combo"
        autoCapitalize="none"
      />
      {save.error && <Banner text={save.error.message} />}
    </Sheet>
  );
}

/** Las cartas que también están en otros mazos míos, y en cuáles (para ir a ellos). */
export function OtherDecksSheet({
  items,
  open,
  onClose,
}: {
  items: OwnershipItemDTO[];
  open: boolean;
  onClose: () => void;
}) {
  const shared = items.filter((i) => i.fromOtherDecks > 0);
  return (
    <Sheet open={open} onClose={onClose} title={t("En otros mazos", "In other decks")}>
      <T variant="small">
        {t(
          "Estas cartas las tienes, pero sus copias ya están en otros mazos tuyos (o prestadas).",
          "You own these cards, but their copies are already in other decks of yours (or lent).",
        )}
      </T>
      <ScrollView style={{ maxHeight: 460 }}>
        {shared.map((i) => (
          <View key={i.card.oracleId} style={{ paddingVertical: 6, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <CardThumb uri={i.card.imageUrl} width={30} name={i.card.name} />
              <T style={{ flex: 1 }} numberOfLines={1}>
                {i.card.name}
              </T>
              <T variant="mono">{i.fromOtherDecks}</T>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingLeft: 40 }}>
              {i.usedInDecks.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => {
                    onClose();
                    router.push(`/deck/${d.id}`);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: colors.line,
                  }}
                >
                  <Ionicons name="layers-outline" size={12} color={colors.inuse} />
                  <T variant="small" style={{ color: colors.inuse }}>
                    {d.name}
                  </T>
                </Pressable>
              ))}
              {i.usedIn
                .filter((u) => !i.usedInDecks.some((d) => d.name === u))
                .map((u) => (
                  <T key={u} variant="small" style={{ color: colors.inuse }}>
                    {u}
                  </T>
                ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
}
