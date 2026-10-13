// Firma de la versión para Google Play. Si el CI define ANDROID_KEYSTORE_FILE (y la contraseña,
// el alias y la contraseña de la clave), la build release se firma con esa clave de subida; si no,
// con la de depuración (vale para instalar el APK a mano, no para Google Play).
const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_CONFIG = `
        release {
            if (System.getenv("ANDROID_KEYSTORE_FILE")) {
                storeFile file(System.getenv("ANDROID_KEYSTORE_FILE"))
                storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("ANDROID_KEY_ALIAS")
                keyPassword System.getenv("ANDROID_KEY_PASSWORD")
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (gradle.includes("ANDROID_KEYSTORE_FILE")) return cfg;
    // Añade el signingConfig "release" tras el de depuración…
    gradle = gradle.replace(
      /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/,
      (m) => `${m}${RELEASE_CONFIG}`,
    );
    // …y la build release lo usa si hay clave.
    gradle = gradle.replace(
      /(release\s*\{[^{}]*?)signingConfig signingConfigs\.debug/,
      '$1signingConfig System.getenv("ANDROID_KEYSTORE_FILE") ? signingConfigs.release : signingConfigs.debug',
    );
    if (!gradle.includes("signingConfigs.release")) {
      throw new Error("with-release-signing: no se ha encontrado dónde poner la firma");
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
