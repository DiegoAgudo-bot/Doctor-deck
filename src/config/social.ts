/** Parte social: cuándo una carta añadida a la colección merece avisar a quien te sigue. */
export const socialConfig = {
  /** Precio de referencia (EUR, Cardmarket vía Scryfall) a partir del cual se avisa. */
  bigCardEur: 20,
  /** Como mucho, tantos avisos de cartas caras por cada vez que se añaden cartas. */
  maxBigCardsPerAdd: 3,
} as const;
