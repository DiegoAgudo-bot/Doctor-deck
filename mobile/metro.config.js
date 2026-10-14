// Metro por defecto solo ve `mobile/`. La app reutiliza código puro del dominio de la web
// (`../src/domain`, sin dependencias: p. ej. la lógica del contador de vidas), que se importa
// como `@/domain/…` (alias de tsconfig.json).
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, "../src/domain")];

module.exports = config;
