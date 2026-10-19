import { useQueryClient } from "@tanstack/react-query";
import { File } from "expo-file-system";
import { readAsStringAsync } from "expo-file-system/legacy";
import { router, Stack } from "expo-router";
import { useShareIntentContext } from "expo-share-intent";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, View } from "react-native";
import { looksLikeCollectionCsv } from "@/domain/collection/manabox";
import type { CollectionImportResponse, SharedImportResponse } from "@/server/dto";
import { CardThumb, FoilMark } from "~/components/card-bits";
import { toast } from "~/components/toast";
import { Banner, Button, Empty, T } from "~/components/ui";
import { api } from "~/lib/api";
import { thousands } from "~/lib/format";
import { shareFileUri } from "~/lib/share-path";
import { setPendingImport, splitImportText, takePendingImport } from "~/lib/shared";
import { peekShare, takeShare } from "~/lib/share-inbox";
import { useShareInbox } from "~/lib/share-intake";
import { colors, radius } from "~/lib/theme";

type Item = SharedImportResponse["added"][number];

interface Source {
  text: string;
  name: string;
}

/** En qué va la importación; `done`/`total` son tandas mandadas al servidor. */
type Stage =
  | { step: "waiting" }
  | { step: "reading" }
  | { step: "checking"; done: number; total: number }
  | { step: "ready" }
  | { step: "saving"; done: number; total: number }
  | { step: "error"; message: string };

/** Lo que el servidor ha reconocido, sumando las tandas. */
interface Preview {
  kind: "csv" | "list";
  name: string | null;
  added: Item[];
  notFound: string[];
  totalCopies: number;
  looksLikeDeck: boolean;
}

const READ_TIMEOUT_MS = 20_000;

/**
 * Lo compartido desde otra app (o elegido como fichero): se lee aquí mismo, se reconoce por
 * tandas enseñando las cartas según llegan y una barra de progreso, y luego se elige qué hacer:
 * añadirlas a la colección (también con progreso), crear un mazo con la lista o, con el CSV
 * entero, reemplazar la colección.
 */
export default function ShareScreen() {
  const qc = useQueryClient();
  const { resetShareIntent } = useShareIntentContext();
  const inbox = useShareInbox();
  const [source, setSource] = useState<Source | null>(() => {
    const p = takePendingImport();
    return p ? { text: p.text, name: p.source } : null;
  });
  const [stage, setStage] = useState<Stage>(
    source || peekShare() ? { step: "reading" } : { step: "waiting" },
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const chunks = useRef<string[]>([]);
  const readFor = useRef<unknown>(null);

  // 1. Leer lo compartido (texto o fichero) que espera en el buzón.
  useEffect(() => {
    if (source || !inbox || readFor.current === inbox) return;
    readFor.current = inbox;
    const done = () => {
      takeShare();
      resetShareIntent();
    };
    if (inbox.kind === "error") {
      done();
      setStage({
        step: "error",
        message: `No se ha podido recibir lo compartido (${inbox.message}).`,
      });
      return;
    }
    setStage({ step: "reading" });
    const file = inbox.files?.[0];
    if (file && !file.path) {
      done();
      setStage({ step: "error", message: "No llega la ruta del fichero compartido." });
      return;
    }
    (file?.path ? readSharedFile(file.path) : Promise.resolve(inbox.text ?? ""))
      .then((text) => {
        done();
        if (!text.trim()) {
          setStage({ step: "error", message: "Lo compartido está vacío." });
          return;
        }
        setSource({ text, name: file?.fileName ?? "Lista compartida" });
      })
      .catch((e: unknown) => {
        done();
        setStage({
          step: "error",
          message: `No se ha podido leer el fichero (${errorText(e)}). Prueba a guardarlo y elegirlo desde Colección › + › Importar.`,
        });
      });
  }, [source, inbox, resetShareIntent]);

  // 2. Reconocer las cartas por tandas.
  const check = useCallback(async (src: Source) => {
    const csv = looksLikeCollectionCsv(src.text);
    const parts = splitImportText(src.text, csv);
    chunks.current = parts;
    setPreview(null);
    setStage({ step: "checking", done: 0, total: parts.length });
    try {
      for (let i = 0; i < parts.length; i++) {
        const r = await api<SharedImportResponse>("/api/import/shared", {
          body: { text: parts[i], save: false },
        });
        setPreview((p) => merge(p, r, parts.length));
        setStage({ step: "checking", done: i + 1, total: parts.length });
      }
      setStage({ step: "ready" });
    } catch (e) {
      setStage({ step: "error", message: errorText(e) });
    }
  }, []);

  useEffect(() => {
    if (source) void check(source);
  }, [source, check]);

  const finish = (message: string) => {
    void qc.invalidateQueries({ queryKey: ["collection"] });
    toast(message);
    router.replace("/collection");
  };

  // 3a. Añadir a la colección, tanda a tanda.
  async function addAll() {
    const parts = chunks.current;
    setStage({ step: "saving", done: 0, total: parts.length });
    let copies = 0;
    try {
      for (let i = 0; i < parts.length; i++) {
        const r = await api<SharedImportResponse>("/api/import/shared", {
          body: { text: parts[i], save: true },
        });
        copies += r.totalCopies;
        setStage({ step: "saving", done: i + 1, total: parts.length });
      }
      finish(`Añadidas ${thousands(copies)} copias a tu colección.`);
    } catch (e) {
      // Las tandas ya guardadas se quedan: se dice cuántas para no duplicar al reintentar.
      setStage({
        step: "error",
        message: `${errorText(e)}${copies > 0 ? ` Ya se habían añadido ${thousands(copies)} copias.` : ""}`,
      });
    }
  }

  // 3b. Reemplazar la colección con el CSV entero (una sola petición).
  async function replaceAll() {
    if (!source) return;
    setStage({ step: "saving", done: 0, total: 1 });
    try {
      const r = await api<CollectionImportResponse>("/api/collection", {
        body: source.text,
        raw: true,
      });
      finish(`Colección reemplazada: ${thousands(r.totalCards)} copias.`);
    } catch (e) {
      setStage({ step: "error", message: errorText(e) });
    }
  }

  const confirmReplace = () =>
    Alert.alert(
      "¿Reemplazar tu colección?",
      "Las cartas que vinieron de un CSV anterior se sustituyen por las de este. Las que añadiste a mano se quedan.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Reemplazar", style: "destructive", onPress: () => void replaceAll() },
      ],
    );

  const newDeck = () => {
    if (!source) return;
    setPendingImport(source.text, source.name);
    router.replace(
      `/deck-new?fromShare=1${preview?.name ? `&name=${encodeURIComponent(preview.name)}` : ""}`,
    );
  };

  const header = <Stack.Screen options={{ title: "Importar", headerShown: true }} />;

  if (stage.step === "waiting") {
    return (
      <>
        {header}
        <Empty
          icon="share-outline"
          title="Nada que importar"
          text="Comparte una lista o el CSV de tu colección con Doctor Deck desde otra app."
          action={
            <Button label="Ir a mi colección" onPress={() => router.replace("/collection")} />
          }
        />
      </>
    );
  }

  const busy = stage.step === "saving";
  const items = preview?.added ?? [];

  return (
    <View style={{ flex: 1 }}>
      {header}
      <FlatList
        data={items}
        keyExtractor={(a, i) => `${a.card.oracleId}-${i}`}
        contentContainerStyle={{ padding: 16 }}
        initialNumToRender={20}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 10 }}>
            <T variant="h2" numberOfLines={2}>
              {preview?.name ?? source?.name ?? "Lo compartido"}
            </T>
            <Progress stage={stage} />
            {preview && (
              <T variant="small">
                {preview.kind === "csv" ? "CSV de colección" : "Lista"} ·{" "}
                {thousands(preview.added.length)} cartas · {thousands(preview.totalCopies)} copias
              </T>
            )}
            {stage.step === "error" && <Banner text={stage.message} />}
            {preview && preview.notFound.length > 0 && (
              <Banner
                text={`No se han encontrado ${thousands(preview.notFound.length)}: ${preview.notFound.slice(0, 5).join(", ")}${preview.notFound.length > 5 ? "…" : ""}`}
              />
            )}
          </View>
        }
        renderItem={({ item }) => <Row item={item} />}
      />
      <View
        style={{
          gap: 10,
          padding: 16,
          borderTopWidth: 1,
          borderTopColor: colors.line,
          backgroundColor: colors.panel,
        }}
      >
        {stage.step === "error" && source && !preview && (
          <Button label="Reintentar" icon="refresh" onPress={() => void check(source)} />
        )}
        {preview && preview.looksLikeDeck && (
          <Button
            label="Crear un mazo con esta lista"
            icon="layers-outline"
            onPress={newDeck}
            disabled={busy}
          />
        )}
        <Button
          label={
            preview
              ? `Añadir ${thousands(preview.totalCopies)} copias a mi colección`
              : "Añadir a mi colección"
          }
          icon="add-circle-outline"
          kind={preview?.looksLikeDeck ? "secondary" : "primary"}
          onPress={() => void addAll()}
          busy={busy}
          disabled={stage.step !== "ready" || !preview || preview.totalCopies === 0}
        />
        {preview?.kind === "csv" && (
          <Button
            label="Reemplazar mi colección con este CSV"
            kind="secondary"
            onPress={confirmReplace}
            disabled={stage.step !== "ready"}
          />
        )}
        {preview?.kind === "list" && !preview.looksLikeDeck && (
          <Button
            label="Crear un mazo con esta lista"
            kind="secondary"
            onPress={newDeck}
            disabled={stage.step !== "ready"}
          />
        )}
      </View>
    </View>
  );
}

/** Barra de progreso con lo que se está haciendo. */
function Progress({ stage }: { stage: Stage }) {
  const { label, value } =
    stage.step === "reading"
      ? { label: "Leyendo el fichero…", value: 0.05 }
      : stage.step === "checking"
        ? {
            label: `Reconociendo cartas… ${stage.done}/${stage.total}`,
            value: 0.1 + 0.9 * (stage.done / stage.total),
          }
        : stage.step === "saving"
          ? {
              label: `Añadiendo a tu colección… ${stage.done}/${stage.total}`,
              value: 0.1 + 0.9 * (stage.done / stage.total),
            }
          : { label: null, value: null };
  if (value === null) return null;
  return (
    <View style={{ gap: 6 }} accessibilityRole="progressbar" accessibilityLabel={label ?? ""}>
      <T variant="small">{label}</T>
      <View
        style={{
          height: 6,
          borderRadius: radius.sm,
          backgroundColor: colors.raised,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.round(value * 100)}%`,
            height: "100%",
            backgroundColor: colors.accent,
          }}
        />
      </View>
    </View>
  );
}

function Row({ item }: { item: Item }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }}>
      <T variant="mono" style={{ width: 28, textAlign: "right" }}>
        {item.quantity}
      </T>
      <CardThumb uri={item.card.imageUrl} width={34} name={item.card.name} />
      <View style={{ flex: 1 }}>
        <T numberOfLines={1}>{item.card.name}</T>
        {item.card.printing && (
          <T variant="small">
            {item.card.printing.setCode.toUpperCase()} #{item.card.printing.collectorNumber}
            {item.language && item.language !== "en" ? ` · ${item.language.toUpperCase()}` : ""}
          </T>
        )}
      </View>
      {item.foil && <FoilMark />}
    </View>
  );
}

/** Suma una tanda a lo reconocido. Con varias tandas, nunca es un mazo. */
function merge(p: Preview | null, r: SharedImportResponse, total: number): Preview {
  return {
    kind: r.kind,
    name: p?.name ?? r.name,
    added: [...(p?.added ?? []), ...r.added],
    notFound: [...(p?.notFound ?? []), ...r.notFound],
    totalCopies: (p?.totalCopies ?? 0) + r.totalCopies,
    looksLikeDeck: total === 1 && r.looksLikeDeck,
  };
}

/**
 * Lee el fichero compartido. La ruta llega sin codificar (`shareFileUri`); si la API nueva no
 * puede, se prueba con la antigua, y si no responde en 20 s se da por fallido.
 */
async function readSharedFile(path: string): Promise<string> {
  const uri = shareFileUri(path);
  try {
    return await withTimeout(new File(uri).text());
  } catch (first) {
    try {
      return await withTimeout(readAsStringAsync(uri));
    } catch {
      throw first;
    }
  }
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("tarda demasiado")), READ_TIMEOUT_MS);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
