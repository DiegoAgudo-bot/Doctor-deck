import type { Db } from "@/adapters/db/prisma";

/** Valor de `--user email`; si no se indica y solo hay un usuario, ese. */
export async function resolveCliUser(db: Db, argv: string[] = process.argv) {
  const i = argv.indexOf("--user");
  const email = i === -1 ? undefined : argv[i + 1];
  if (email) {
    const user = await db.user.findUnique({ where: { email } });
    if (!user) throw new Error(`No existe ningún usuario con el email ${email}`);
    return user;
  }
  const users = await db.user.findMany({ take: 2 });
  if (users.length === 1 && users[0]) return users[0];
  throw new Error(
    users.length === 0
      ? "No hay usuarios. Regístrate primero en la web."
      : 'Hay varios usuarios: indica cuál con --user "email@ejemplo.com"',
  );
}
