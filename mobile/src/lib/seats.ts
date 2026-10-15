/**
 * Dónde se sienta cada jugador con el móvil en la mesa entre todos: la mitad a la izquierda y la
 * otra mitad a la derecha (cada uno ve su contador de frente) y, si son impares, uno abajo. El
 * orden de los índices sigue el sentido de las agujas del reloj: la izquierda de abajo arriba,
 * la derecha de arriba abajo y luego el de abajo.
 */
export function seatLayout(n: number): { left: number[]; right: number[]; bottom: number | null } {
  const side = Math.floor(n / 2);
  const left = Array.from({ length: side }, (_, i) => side - 1 - i);
  const right = Array.from({ length: side }, (_, i) => side + i);
  return { left, right, bottom: n % 2 === 1 ? n - 1 : null };
}

/** Hacia dónde mira cada jugador: desde el borde izquierdo, el derecho o el de abajo. */
export type Facing = "left" | "right" | "bottom";
