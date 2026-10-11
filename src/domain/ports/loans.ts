import type { Member } from "./play";

export interface Loan {
  id: string;
  lenderId: string;
  lender: Member;
  borrower: Member | null;
  /** Nombre de quien no tiene cuenta (si `borrower` es null). */
  borrowerName: string | null;
  oracleId: string;
  name: string;
  quantity: number;
  note: string;
  createdAt: Date;
  returnedAt: Date | null;
}

export interface LoanRepository {
  create(data: {
    lenderId: string;
    borrowerId: string | null;
    borrowerName: string | null;
    oracleId: string;
    name: string;
    quantity: number;
    note: string;
  }): Promise<string>;
  get(id: string): Promise<Loan | null>;
  /** Lo que he prestado y lo que me han prestado (activos primero, luego los devueltos). */
  forUser(userId: string, includeReturned: boolean): Promise<{ lent: Loan[]; borrowed: Loan[] }>;
  markReturned(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}
