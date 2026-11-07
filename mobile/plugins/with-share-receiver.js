// Recibir lo que se comparte desde otras apps (listas y CSV/TXT de la colección) con una actividad
// propia (`ShareReceiverActivity`, en share-receiver/) que lo guarda y abre la app como desde el
// icono. La actividad de React Native no recibe nunca lo compartido: cuando lo recibía estando la
// app en segundo plano, a veces se quedaba la pantalla en negro.
const fs = require("node:fs");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("expo/config-plugins");

// Lo que comparte ManaBox (y apps parecidas): la lista como texto o el CSV/TXT como fichero.
const MIME_TYPES = ["text/*", "application/csv", "application/vnd.ms-excel"];
const ACTIVITY = ".ShareReceiverActivity";

function withManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.activity = (app.activity ?? []).filter((a) => a.$["android:name"] !== ACTIVITY);
    app.activity.push({
      $: {
        "android:name": ACTIVITY,
        "android:exported": "true",
        "android:excludeFromRecents": "true",
        "android:noHistory": "true",
        "android:launchMode": "standard",
        // Nunca en la tarea de la app: se cierra al momento y deja la app delante.
        "android:taskAffinity": "",
        "android:theme": "@android:style/Theme.Translucent.NoTitleBar",
      },
      "intent-filter": ["android.intent.action.SEND", "android.intent.action.SEND_MULTIPLE"].map(
        (action) => ({
          action: [{ $: { "android:name": action } }],
          category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
          data: MIME_TYPES.map((mimeType) => ({ $: { "android:mimeType": mimeType } })),
        }),
      ),
    });
    return cfg;
  });
}

function withSource(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const pkg = cfg.android?.package;
      if (!pkg) throw new Error("with-share-receiver: falta android.package");
      const dir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app/src/main/java",
        ...pkg.split("."),
      );
      fs.mkdirSync(dir, { recursive: true });
      const source = fs
        .readFileSync(path.join(__dirname, "share-receiver/ShareReceiverActivity.kt"), "utf8")
        .replace(/^package .*$/m, `package ${pkg}`);
      fs.writeFileSync(path.join(dir, "ShareReceiverActivity.kt"), source);
      return cfg;
    },
  ]);
}

module.exports = function withShareReceiver(config) {
  return withSource(withManifest(config));
};
