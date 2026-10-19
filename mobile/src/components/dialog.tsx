import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { colors, radius } from "~/lib/theme";
import { Button, T } from "./ui";

export interface DialogButton {
  text: string;
  /** Como en `Alert.alert`: `cancel` cierra sin más, `destructive` va en rojo. */
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void | Promise<void>;
}

interface DialogData {
  id: number;
  title: string;
  message?: string | undefined;
  buttons: DialogButton[];
}

let listener: ((d: DialogData) => void) | null = null;
let next = 1;

/**
 * Pregunta con los colores de la app en vez del diálogo de Android. Se usa igual que
 * `Alert.alert(título, mensaje, botones)`; sin botones, solo «Aceptar».
 */
export function alert(title: string, message?: string, buttons?: DialogButton[]) {
  listener?.({
    id: next++,
    title,
    message: message || undefined,
    buttons: buttons?.length ? buttons : [{ text: "Aceptar" }],
  });
}

/** Donde se pintan las preguntas (una vez, en el layout raíz). Si llega otra, va detrás. */
export function DialogHost() {
  const [queue, setQueue] = useState<DialogData[]>([]);
  const current = queue[0];

  useEffect(() => {
    listener = (d) => setQueue((q) => [...q, d]);
    return () => {
      listener = null;
    };
  }, []);

  const close = (button?: DialogButton) => {
    setQueue((q) => q.slice(1));
    void button?.onPress?.();
  };

  const cancel = current?.buttons.find((b) => b.style === "cancel");
  const actions = current?.buttons.filter((b) => b !== cancel) ?? [];
  // Dos botones cortos caben en una fila (Cancelar a la izquierda); si no, uno debajo de otro.
  const inRow = actions.length <= 1 && (current?.buttons ?? []).every((b) => b.text.length <= 14);

  return (
    <Modal
      visible={!!current}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close(cancel)}
    >
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Pressable
          accessibilityLabel="Cerrar"
          onPress={() => (cancel ? close(cancel) : undefined)}
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.6)" }}
        />
        {current && (
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: colors.panel,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.line,
              padding: 20,
              gap: 16,
            }}
          >
            <View style={{ gap: 8 }}>
              <T variant="h2">{current.title}</T>
              {current.message && <T variant="muted">{current.message}</T>}
            </View>
            <View style={{ flexDirection: inRow ? "row" : "column", gap: 10 }}>
              {inRow && cancel && (
                <Button
                  label={cancel.text}
                  kind="secondary"
                  onPress={() => close(cancel)}
                  style={{ flex: 1 }}
                />
              )}
              {actions.map((b) => (
                <Button
                  key={b.text}
                  label={b.text}
                  kind={b.style === "destructive" ? "danger" : inRow ? "primary" : "secondary"}
                  onPress={() => close(b)}
                  style={inRow ? { flex: 1 } : undefined}
                />
              ))}
              {!inRow && cancel && (
                <Button label={cancel.text} kind="ghost" onPress={() => close(cancel)} />
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
