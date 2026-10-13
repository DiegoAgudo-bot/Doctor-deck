/**
 * Lo que llega para importar (compartido desde ManaBox o elegido como fichero) hasta que lo
 * recoge la pantalla de importar: puede ser un CSV de megas, demasiado para un parámetro de ruta.
 */
let pending: { text: string; source: string } | null = null;

export const setPendingImport = (text: string, source: string) => {
  pending = { text, source };
};

export const takePendingImport = () => {
  const p = pending;
  pending = null;
  return p;
};
