// Para las pantallas: el idioma de la app y `t()` (ver `lang.ts`).
export { intl, isEn, locale, t } from "./lang";

import { roleLabel } from "@/domain/i18n/labels";
import type { Role } from "@/domain/roles/types";
import { locale as appLocale } from "./lang";

/** Nombre de un rol en el idioma de la app («robo» / «draw»). */
export const roleName = (r: Role) => roleLabel(r, appLocale);
