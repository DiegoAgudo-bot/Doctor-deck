import * as Haptics from "expo-haptics";

/** Vibración corta al hacer algo que cambia datos (añadir una copia, aplicar un cambio…). */
export const tapFeedback = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};
