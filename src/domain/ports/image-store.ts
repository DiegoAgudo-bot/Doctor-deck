/** Imágenes de cartas guardadas en nuestro servidor (ver `domain/cards/images.ts`). */
export interface ImageStore {
  /**
   * La imagen de esa ruta de Scryfall: de disco si ya la teníamos; si no, se pide a Scryfall y se
   * guarda (mientras quepa en la caché). null si Scryfall no la da y no la teníamos.
   */
  get(path: string): Promise<{ body: Uint8Array; contentType: string; cached: boolean } | null>;
}
