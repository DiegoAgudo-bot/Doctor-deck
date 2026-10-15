/**
 * La ruta que da el módulo de compartir para un fichero es `file://` + la ruta tal cual, sin
 * codificar: con un espacio («ManaBox Collection.csv»), `#` o `%` en el nombre no es una URI
 * válida y leerla falla. Se codifica cada tramo; las `content://` se dejan como vienen.
 */
export function shareFileUri(path: string): string {
  if (!path.startsWith("file://"))
    return path.startsWith("/") ? shareFileUri(`file://${path}`) : path;
  const raw = path.slice("file://".length);
  // Si ya viene codificada (tiene %XX válidos y ningún carácter que haya que codificar), tal cual.
  if (/%[0-9a-f]{2}/i.test(raw) && !/[\s#?]/.test(raw)) return path;
  return `file://${raw.split("/").map(encodeURIComponent).join("/")}`;
}
