/** 1.5 → "1,50 €" */
export const formatEuros = (x: number) => `${x.toFixed(2).replace(".", ",")} €`;
