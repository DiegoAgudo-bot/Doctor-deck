import type { Loan, LoanRepository } from "@/domain/ports/loans";
import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./prisma";

const MEMBER = { id: true, username: true, name: true, image: true } as const;
const INCLUDE = {
  lender: { select: MEMBER },
  borrower: { select: MEMBER },
} satisfies Prisma.LoanInclude;

function loanFromRow(l: Prisma.LoanGetPayload<{ include: typeof INCLUDE }>): Loan {
  return {
    id: l.publicId,
    lenderId: l.lenderId,
    lender: l.lender,
    borrower: l.borrower,
    borrowerName: l.borrowerName,
    oracleId: l.oracleId,
    name: l.name,
    quantity: l.quantity,
    note: l.note,
    createdAt: l.createdAt,
    returnedAt: l.returnedAt,
  };
}

/** Préstamos de cartas entre jugadores. */
export class PrismaLoanRepository implements LoanRepository {
  constructor(private readonly db: Db) {}

  async create(data: Parameters<LoanRepository["create"]>[0]) {
    return (await this.db.loan.create({ data })).publicId;
  }

  async get(id: string) {
    const l = await this.db.loan.findUnique({ where: { publicId: id }, include: INCLUDE });
    return l ? loanFromRow(l) : null;
  }

  async forUser(userId: string, includeReturned: boolean) {
    const where = includeReturned ? {} : { returnedAt: null };
    const orderBy = [
      { returnedAt: { sort: "desc", nulls: "first" } },
      { createdAt: "desc" },
    ] as const;
    const [lent, borrowed] = await Promise.all([
      this.db.loan.findMany({
        where: { lenderId: userId, ...where },
        include: INCLUDE,
        orderBy: [...orderBy],
      }),
      this.db.loan.findMany({
        where: { borrowerId: userId, ...where },
        include: INCLUDE,
        orderBy: [...orderBy],
      }),
    ]);
    return { lent: lent.map(loanFromRow), borrowed: borrowed.map(loanFromRow) };
  }

  async markReturned(id: string) {
    await this.db.loan.updateMany({
      where: { publicId: id, returnedAt: null },
      data: { returnedAt: new Date() },
    });
  }

  async delete(id: string) {
    await this.db.loan.deleteMany({ where: { publicId: id } });
  }
}
