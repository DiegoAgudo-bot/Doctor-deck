import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";

/**
 * Caché de la API. Se guarda en el móvil (AsyncStorage) para enseñar la colección, los mazos y
 * los avisos sin conexión o mientras llega lo nuevo; un día como mucho.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60_000,
      retry: (count, err) =>
        !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "doctordeck-cache",
  throttleTime: 2000,
});

/** Al cambiar de cuenta o salir: nada de lo de antes. */
export async function clearCache() {
  queryClient.clear();
  await AsyncStorage.removeItem("doctordeck-cache");
}
