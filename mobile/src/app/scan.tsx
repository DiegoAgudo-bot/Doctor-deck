import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, Stack, useIsFocused } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
} from "react-native-vision-camera";
import {
  useTextRecognition,
  type BlockData,
  type TextRecognitionOptions,
} from "react-native-vision-camera-ocr-plus";
import { createSynchronizable, scheduleOnRN } from "react-native-worklets";
import type { AddCardsResponse, ScanIdentifyResponse } from "@/server/dto";
import { CardThumb, FoilMark } from "~/components/card-bits";
import { toast } from "~/components/toast";
import { Button, Empty, IconButton, T } from "~/components/ui";
import { useCopyDefaults } from "~/lib/add-copies";
import { api } from "~/lib/api";
import { euros } from "~/lib/format";
import {
  addScanned,
  orderLines,
  ScanTracker,
  scannedTotals,
  upgradeLatest,
  type ScannedCopy,
} from "~/lib/scan";
import { colors, radius } from "~/lib/theme";

const STORE_KEY = "doctordeck:scan";

/**
 * Zona de la imagen en la que se busca texto (la carta, centrada), en % del fotograma: deja fuera
 * lo que hay alrededor (otras cartas en la mesa) y acelera el reconocimiento.
 */
const OCR_OPTIONS: TextRecognitionOptions = {
  language: "latin",
  // El OCR va en segundo plano y devuelve el último resultado: con 2 se lee casi cada fotograma
  // que da tiempo a procesar, sin cola.
  frameSkipThreshold: 2,
  scanRegion: { left: "6%", top: "10%", width: "88%", height: "74%" },
};

/** Con la carta quieta, cada cuánto se vuelve a mandar lo leído (otra lectura que confirme). */
const RESEND_MS = 300;

/** Sin leer nada durante este tiempo → sugerir la linterna. */
const DARK_HINT_MS = 2500;

type Status =
  { kind: "idle" } | { kind: "reading"; detail: string | null } | { kind: "found"; name: string };

/**
 * Escáner de cartas: la cámara lee el texto de la carta en el móvil (ML Kit), el servidor la
 * reconoce (edición + número o nombre) y la carta entra en una lista; al final, «Añadir N a la
 * colección». Pensado para ir rápido: se pasan cartas una tras otra sin tocar la pantalla.
 */
export default function ScanScreen() {
  const permission = useCameraPermission();
  if (!permission.hasPermission) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: "Escanear cartas" }} />
        <Empty
          icon="camera-outline"
          title="Hace falta la cámara"
          text="Para reconocer tus cartas. Las imágenes no salen del móvil: solo se manda el texto que se lee."
        />
        <View style={{ paddingHorizontal: 24 }}>
          {permission.canRequestPermission ? (
            <Button
              label="Permitir la cámara"
              icon="camera"
              onPress={() => void permission.requestPermission()}
            />
          ) : (
            <Button
              label="Abrir los ajustes del móvil"
              icon="settings-outline"
              onPress={() => void Linking.openSettings()}
            />
          )}
        </View>
      </View>
    );
  }
  return <Scanner />;
}

function Scanner() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);

  const device = useCameraDevice("back");
  const [torch, setTorch] = useState(false);
  const [foil, setFoil] = useState(false);
  const [defaults] = useCopyDefaults();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [dark, setDark] = useState(false);

  // La lista de lo escaneado se guarda en el móvil: no se pierde al salir de la pantalla.
  const [list, setListState] = useState<ScannedCopy[]>([]);
  const listRef = useRef(list);
  const setList = useCallback((next: ScannedCopy[]) => {
    listRef.current = next;
    setListState(next);
    AsyncStorage.setItem(STORE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  useEffect(() => {
    AsyncStorage.getItem(STORE_KEY)
      .then((raw) => raw && setList(JSON.parse(raw) as ScannedCopy[]))
      .catch(() => {});
  }, [setList]);

  // Lo que hace falta dentro de los callbacks sin volver a crearlos.
  const settings = useRef({ foil, defaults });
  settings.current = { foil, defaults };

  const tracker = useMemo(() => new ScanTracker(), []);
  const cache = useRef(new Map<string, ScanIdentifyResponse>());
  const inFlight = useRef(false);
  const pending = useRef<string[] | null>(null);
  const lastTextAt = useRef(Date.now());

  const handleResult = useCallback(
    (res: ScanIdentifyResponse) => {
      const m = res.match;
      const event = tracker.observe(
        m
          ? {
              oracleId: m.card.oracleId,
              scryfallId: m.printing?.scryfallId ?? null,
              confidence: m.confidence,
            }
          : null,
        Date.now(),
      );
      if (!m) {
        const r = res.reading;
        setStatus({
          kind: "reading",
          detail:
            r.setCode && r.collectorNumber
              ? `${r.setCode.toUpperCase()} #${r.collectorNumber}`
              : null,
        });
        return;
      }
      setStatus({ kind: "found", name: m.card.name });
      if (!event) return;
      const printingLabel = m.printing
        ? `${m.printing.setCode.toUpperCase()} #${m.printing.collectorNumber}`
        : null;
      const { foil: isFoil, defaults: d } = settings.current;
      const price = isFoil && m.printing?.priceEurFoil != null ? m.printing.priceEurFoil : m.price;
      if (event.kind === "accept") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setList(
          addScanned(listRef.current, {
            oracleId: m.card.oracleId,
            scryfallId: m.printing?.scryfallId ?? null,
            name: m.card.name,
            printingLabel,
            imageUrl: m.card.imageUrl,
            price,
            quantity: 1,
            foil: isFoil,
            // El idioma impreso en la carta («MKM • ES») manda sobre el de la última vez.
            language: res.reading.language ?? d.language,
            condition: d.condition,
          }),
        );
      } else {
        setList(
          upgradeLatest(listRef.current, m.card.oracleId, {
            scryfallId: m.printing?.scryfallId ?? null,
            printingLabel,
            imageUrl: m.card.imageUrl,
            price,
          }),
        );
      }
    },
    [tracker, setList],
  );

  /** Pide al servidor qué carta es (una petición a la vez; si llegan más, solo la última). */
  const identify = useCallback(
    async (lines: string[]) => {
      if (inFlight.current) {
        pending.current = lines;
        return;
      }
      inFlight.current = true;
      try {
        const key = lines.join("\n");
        let res = cache.current.get(key);
        if (!res) {
          res = await api<ScanIdentifyResponse>("/api/scan/identify", { body: { lines } });
          cache.current.set(key, res);
          if (cache.current.size > 300) {
            const oldest = cache.current.keys().next().value;
            if (oldest !== undefined) cache.current.delete(oldest);
          }
        }
        handleResult(res);
      } catch (e) {
        setStatus({ kind: "idle" });
        toast(e instanceof Error ? e.message : "No se ha podido reconocer la carta");
      } finally {
        inFlight.current = false;
        const next = pending.current;
        pending.current = null;
        if (next) void identify(next);
      }
    },
    [handleResult],
  );

  /** Lo que lee el OCR (en el hilo de JS). */
  const onText = useCallback(
    (blocks: BlockData[]) => {
      const lines = orderLines(blocks);
      if (lines.length < 2) {
        tracker.observe(null, Date.now());
        if (Date.now() - lastTextAt.current > DARK_HINT_MS) setDark(true);
        setStatus({ kind: "idle" });
        return;
      }
      lastTextAt.current = Date.now();
      setDark(false);
      void identify(lines);
    },
    [tracker, identify],
  );
  const onTextRef = useRef(onText);
  onTextRef.current = onText;
  const deliver = useCallback((blocks: BlockData[]) => onTextRef.current(blocks), []);

  // Sin texto un rato (no hay carta o hay poca luz): aviso para encender la linterna.
  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - lastTextAt.current > DARK_HINT_MS) setDark(true);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const { scanText } = useTextRecognition(OCR_OPTIONS);
  // El último texto mandado a JS y cuándo: se cruza de hilo cuando cambia lo que se lee o, si no
  // cambia (la carta está quieta), cada 300 ms, para que dos lecturas seguidas puedan coincidir.
  const lastText = useMemo(() => createSynchronizable(""), []);
  const lastSent = useMemo(() => createSynchronizable(0), []);
  const frameOutput = useFrameOutput({
    // ML Kit en Android necesita RGB; 1080p da para leer el número de coleccionista (letra muy
    // pequeña) sin que el reconocimiento se vuelva lento.
    pixelFormat: "rgb",
    targetResolution: { width: 1080, height: 1920 },
    onFrame(frame) {
      "worklet";
      const result = scanText(frame);
      frame.dispose();
      const text = result.resultText;
      const now = Date.now();
      const changed = text !== lastText.getDirty();
      if (changed || (text.length > 0 && now - lastSent.getDirty() >= RESEND_MS)) {
        lastText.setBlocking(text);
        lastSent.setBlocking(now);
        scheduleOnRN(deliver, result.blocks);
      }
    },
  });

  const totals = scannedTotals(list);
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  async function addAll() {
    const items = listRef.current;
    if (items.length === 0) return;
    setSaving(true);
    try {
      for (let i = 0; i < items.length; i += 500) {
        await api<AddCardsResponse>("/api/collection/cards", {
          body: {
            cards: items.slice(i, i + 500).map((c) => ({
              ...(c.scryfallId ? { scryfallId: c.scryfallId } : { oracleId: c.oracleId }),
              quantity: c.quantity,
              foil: c.foil,
              language: c.language,
              condition: c.condition,
            })),
          },
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(
        totals.copies === 1
          ? "Añadida 1 copia a tu colección"
          : `Añadidas ${totals.copies} copias a tu colección`,
      );
      setList([]);
      tracker.reset();
      void qc.invalidateQueries({ queryKey: ["collection"] });
    } catch (e) {
      toast(`No se han podido añadir: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      setSaving(false);
    }
  }

  // Marco de la carta, centrado en la parte de arriba (abajo va la lista).
  const guideW = Math.min(width * 0.78, 340);
  const guideH = guideW * (88 / 63);
  const panelH = Math.max(200, height * 0.3);
  const guideTop = Math.max(insets.top + 60, (height - panelH - guideH) / 2);
  const borderColor =
    status.kind === "found" ? colors.in : status.kind === "reading" ? colors.accent : "#ffffffaa";

  const statusText =
    status.kind === "found"
      ? status.name
      : status.kind === "reading"
        ? status.detail
          ? `Leyendo… ${status.detail}`
          : "Leyendo…"
        : dark && !torch
          ? "¿Poca luz? Enciende la linterna"
          : "Pon una carta dentro del marco";

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      {device ? (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={focused && appActive}
          outputs={[frameOutput]}
          torchMode={torch && device.hasTorch ? "on" : "off"}
          // Sin `enableLowLightBoost`: CameraX lanza una excepción al tocarlo (también al pasar
          // `false`) en los móviles que no lo admiten. Con poca luz, la linterna.
          enableNativeTapToFocusGesture
          enableNativeZoomGesture
          resizeMode="cover"
          onError={(e) => {
            // Sin el texto de la excepción de Java: no le dice nada a quien escanea.
            console.warn("Cámara", e);
            toast("La cámara ha fallado. Ciérrala y vuelve a abrirla.");
          }}
        />
      ) : (
        <Empty icon="camera-outline" title="No se encuentra la cámara trasera" />
      )}

      {/* Marco de la carta */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: guideTop,
          left: (width - guideW) / 2,
          width: guideW,
          height: guideH,
          borderRadius: 14,
          borderWidth: 3,
          borderColor,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: guideTop + guideH + 10,
          left: 16,
          right: 16,
          alignItems: "center",
        }}
      >
        <Text style={s.status} numberOfLines={1}>
          {statusText}
        </Text>
      </View>

      {/* Barra de arriba */}
      <View style={[s.topbar, { top: insets.top + 6 }]}>
        <Round icon="close" label="Cerrar" onPress={() => router.back()} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            onPress={() => setFoil(!foil)}
            accessibilityRole="switch"
            accessibilityState={{ checked: foil }}
            accessibilityLabel="Las siguientes son foil"
            style={[s.pill, foil && { backgroundColor: colors.foil }]}
          >
            <FoilMark size={12} />
            <Text style={[s.pillText, foil && { color: "#1a1400" }]}>Foil</Text>
          </Pressable>
          {device?.hasTorch && (
            <Round
              icon={torch ? "flashlight" : "flashlight-outline"}
              label={torch ? "Apagar la linterna" : "Encender la linterna"}
              onPress={() => setTorch(!torch)}
              active={torch}
              highlight={dark && !torch}
            />
          )}
        </View>
      </View>

      {/* Lo escaneado */}
      <View
        style={[s.panel, { height: panelH + insets.bottom, paddingBottom: insets.bottom + 10 }]}
      >
        <View style={s.panelHead}>
          <T variant="h2">
            {totals.copies === 0
              ? "Nada escaneado todavía"
              : `${totals.copies} ${totals.copies === 1 ? "carta" : "cartas"} · ${euros(totals.value)}`}
          </T>
          {list.length > 0 && (
            <Pressable
              onPress={() => {
                setList([]);
                tracker.reset();
              }}
              hitSlop={8}
            >
              <T variant="small" style={{ color: colors.text3 }}>
                Vaciar
              </T>
            </Pressable>
          )}
        </View>
        <FlatList
          data={list}
          keyExtractor={(c, i) => `${c.oracleId}|${c.scryfallId}|${c.foil}|${c.language}|${i}`}
          style={{ flex: 1 }}
          ListEmptyComponent={
            <T variant="small" style={{ color: colors.text3, paddingVertical: 8 }}>
              Pasa las cartas una a una por el marco: cada una vibra al reconocerse. Para contar
              otra copia de la misma, quítala y vuelve a ponerla.
            </T>
          }
          renderItem={({ item, index }) => (
            <ScannedRow
              item={item}
              onRemove={() => {
                const next = [...listRef.current];
                const c = next[index];
                if (!c) return;
                if (c.quantity > 1) next[index] = { ...c, quantity: c.quantity - 1 };
                else next.splice(index, 1);
                setList(next);
                if (index === 0) tracker.reset();
              }}
              onToggleFoil={() => {
                const next = [...listRef.current];
                const c = next[index];
                if (c) next[index] = { ...c, foil: !c.foil };
                setList(next);
              }}
            />
          )}
        />
        <Button
          label={
            totals.copies === 0 ? "Añadir a la colección" : `Añadir ${totals.copies} a la colección`
          }
          icon="add"
          onPress={() => void addAll()}
          disabled={totals.copies === 0}
          busy={saving}
        />
      </View>
    </View>
  );
}

function ScannedRow({
  item,
  onRemove,
  onToggleFoil,
}: {
  item: ScannedCopy;
  onRemove: () => void;
  onToggleFoil: () => void;
}) {
  return (
    <View style={s.row}>
      <CardThumb uri={item.imageUrl} width={34} name={item.name} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowName} numberOfLines={1}>
          {item.quantity > 1 ? `${item.quantity}× ` : ""}
          {item.name}
        </Text>
        <Text style={s.rowMeta} numberOfLines={1}>
          {[
            item.printingLabel ?? "edición sin leer",
            item.language.toUpperCase(),
            euros(item.price),
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <Pressable
        onPress={onToggleFoil}
        hitSlop={6}
        accessibilityRole="switch"
        accessibilityState={{ checked: item.foil }}
        accessibilityLabel={`Foil: ${item.name}`}
        style={[s.foilToggle, item.foil && { borderColor: colors.foil }]}
      >
        <FoilMark size={11} />
      </Pressable>
      <IconButton icon="remove-circle-outline" label={`Quitar ${item.name}`} onPress={onRemove} />
    </View>
  );
}

function Round({
  icon,
  label,
  onPress,
  active,
  highlight,
}: {
  icon: React.ComponentProps<typeof IconButton>["icon"];
  label: string;
  onPress: () => void;
  active?: boolean;
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        s.round,
        active && { backgroundColor: colors.foil },
        highlight && { borderColor: colors.warn, borderWidth: 2 },
      ]}
    >
      <IconButton
        icon={icon}
        label={label}
        onPress={onPress}
        color={active ? "#1a1400" : "#fff"}
        size={22}
      />
    </View>
  );
}

const s = StyleSheet.create({
  topbar: {
    position: "absolute",
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#000000aa",
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: "#000000aa",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pillText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  status: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    backgroundColor: "#000000aa",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.panel,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 8,
  },
  panelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowName: { color: colors.text, fontSize: 15, fontWeight: "500" },
  rowMeta: { color: colors.text3, fontSize: 12, marginTop: 1 },
  foilToggle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
});
