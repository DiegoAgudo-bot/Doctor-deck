import type { TradeCopy } from "../trades/proposal";

export const PROPOSAL_STATUSES = ["draft", "pending", "accepted", "rejected", "cancelled"] as const;
/**
 * draft: borrador (solo lo ve quien lo crea). pending: enviada, le toca responder a `turnUserId`.
 * accepted: hecha (las cartas ya se han movido entre las colecciones). rejected / cancelled.
 */
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** Una línea de la propuesta: copias que da `giverId`. */
export interface ProposalItem extends TradeCopy {
  giverId: string;
}

export interface TradeProposal {
  /** publicId (uuid). */
  id: string;
  fromUserId: string;
  toUserId: string;
  status: ProposalStatus;
  turnUserId: string | null;
  version: number;
  lastById: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  /** Las líneas de la versión actual. */
  items: ProposalItem[];
}

export interface NewProposal {
  fromUserId: string;
  toUserId: string;
  status: "draft" | "pending";
  turnUserId: string | null;
  items: readonly ProposalItem[];
}

/** No se puede aceptar: a quien da le faltan copias (las ha quitado de su colección). */
export class MissingCopiesError extends Error {
  constructor(
    readonly giverId: string,
    readonly oracleIds: string[],
  ) {
    super("Ya no están todas las cartas de la propuesta en la colección de quien las da");
    this.name = "MissingCopiesError";
  }
}

/** Propuestas de intercambio. Las comprobaciones de quién puede hacer qué van en el caso de uso. */
export interface TradeProposalRepository {
  create(p: NewProposal): Promise<string>;
  get(id: string): Promise<TradeProposal | null>;
  /** Las propuestas en las que participa (sus borradores sí, los de otros no), de la más reciente. */
  listFor(userId: string): Promise<TradeProposal[]>;
  /** Una propuesta abierta (borrador mío o pendiente) entre los dos, si la hay. */
  openBetween(userId: string, otherId: string): Promise<TradeProposal | null>;
  /**
   * Cambia las líneas y el estado. Con `newVersion` las líneas van a una versión nueva (una
   * contrapropuesta) y las anteriores se quedan como historial; si no, reemplazan las actuales.
   */
  update(
    id: string,
    data: {
      items?: readonly ProposalItem[] | undefined;
      newVersion?: boolean | undefined;
      byUserId: string;
      status: ProposalStatus;
      turnUserId: string | null;
    },
  ): Promise<void>;
  /**
   * Acepta: en una transacción, quita las copias de la colección de quien las da (primero las de
   * esa impresión, foil e idioma; si no, otras de la misma carta) y se las añade a quien las
   * recibe como cartas sueltas, y cierra la propuesta. Si a alguien le faltan copias no cambia
   * nada y lanza `MissingCopiesError`.
   */
  accept(id: string): Promise<void>;
  /** Borra un borrador. */
  delete(id: string): Promise<void>;
}
