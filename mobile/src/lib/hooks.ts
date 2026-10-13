import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/** Valor que se queda quieto `ms` tras el último cambio (búsquedas mientras se escribe). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Estado que se recuerda en el móvil (vista en rejilla o lista, orden…). */
export function useStoredState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    AsyncStorage.getItem(`pref:${key}`)
      .then((raw) => {
        if (raw) setValue(JSON.parse(raw) as T);
      })
      .catch(() => {});
  }, [key]);
  return [
    value,
    (v: T) => {
      setValue(v);
      AsyncStorage.setItem(`pref:${key}`, JSON.stringify(v)).catch(() => {});
    },
  ];
}
