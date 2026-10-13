# Doctor Deck · app Android

App nativa (Expo + React Native, `expo-router`) que usa la misma API JSON que la web
(`https://doctordeck.app/api/*`). La estructura copia la de ManaBox: barra inferior con
**Colección**, **Mazos**, **Buscar**, **Avisos** y **Más**.

## Qué hace

- **Entrar**: email y contraseña o Google (se abre el navegador y vuelve a `doctordeck://` con la
  sesión; plugin `expo` de Better Auth). La cookie se guarda cifrada (`expo-secure-store`).
- **Colección**: buscar, ordenar (valor, nombre, recientes, copias, precio, coste) con dirección,
  colores, foil y libres; lista o rejilla. Lo último cargado se ve sin conexión (caché de
  TanStack Query guardada en el móvil).
- **Ficha de carta**: imagen, texto, roles, precios, mis copias con − / + y **añadir** eligiendo
  edición, foil, idioma y estado (como ManaBox); lista de deseos; Cardmarket.
- **Mazos**: portada con el arte del comandante; dentro, lista por tipos (con qué tengo), **Me
  falta** (con coste y "compartir lista"), **Cambios** sugeridos y **Datos** (curva, roles,
  bracket). Nuevo mazo pegando la lista o un enlace.
- **Compartir desde ManaBox**: la app sale en el menú de compartir de Android con texto
  (`1 Carta (SET) 123 *F*`) y con ficheros CSV/TXT. Enseña qué cartas son y deja añadirlas a la
  colección, crear un mazo o (con el CSV entero) reemplazar la colección. También desde
  Colección › + › Importar fichero.
- **Avisos** y **notificaciones push** (si el servidor tiene `FCM_SERVICE_ACCOUNT` y la build lleva
  `google-services.json`). Tocar una abre su pantalla.
- **Más**: contador de vidas, grupos, intercambios, préstamos, comunidad, actividad y ajustes se
  abren de la web dentro de la app, con la sesión (`/api/app/web`).
- Si la versión es menor que `MOBILE_MIN_VERSION` del servidor (`GET /api/app`), pide actualizar.

Pendiente (v2): escáner de cartas con la cámara (el endpoint `POST /api/collection/cards` con
`scryfallId` ya existe).

## Desarrollo

```bash
cd mobile
npm install
npm run typecheck        # tsc (también comprueba los tipos de la API: ../src/server/dto.ts)
npm test                 # tests de lib/ (node:test)
npx expo prebuild --platform android   # genera android/ (no se sube al repo)
npx expo run:android     # con un móvil o emulador conectado
```

Contra otro servidor: `EXPO_PUBLIC_API_URL=http://192.168.1.10:3000 npx expo run:android`.

La app importa **solo tipos** de la web (`@/server/dto`); el código de la app usa `~/…` (`src/`).
Las rutas están en `src/app/` (cada fichero es una pantalla).

## Compilar e instalar

El workflow **App móvil** (`.github/workflows/mobile.yml`) compila en cada push a `main` que toca
`mobile/` o a mano (Actions › App móvil › Run workflow). Deja en el run el artefacto
`doctor-deck-android-N` con:

- `app-release.apk`: para instalar a mano en el móvil (permitir "instalar apps desconocidas").
- `app-release.aab`: para subir a Google Play (prueba interna).

Secretos del repositorio que usa (todos opcionales):

| Secreto                     | Para qué                                                          |
| --------------------------- | ----------------------------------------------------------------- |
| `GOOGLE_SERVICES_JSON_B64`  | `google-services.json` de Firebase en base64: notificaciones push |
| `ANDROID_KEYSTORE_B64`      | Clave de subida de Google Play (`.jks` en base64)                 |
| `ANDROID_KEYSTORE_PASSWORD` | Contraseña del almacén                                            |
| `ANDROID_KEY_ALIAS`         | Alias de la clave                                                 |
| `ANDROID_KEY_PASSWORD`      | Contraseña de la clave                                            |

Sin clave de subida se firma con la de depuración: se instala bien a mano, pero Google Play no lo
acepta. Crear la clave (una vez, y guardarla bien: sin ella no se pueden publicar
actualizaciones):

```bash
keytool -genkeypair -v -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 \
  -keystore upload.jks -alias doctordeck
base64 -w0 upload.jks   # → ANDROID_KEYSTORE_B64
```

El `versionCode` es el número del run; la versión visible (`1.0.0`) está en `app.config.ts`.

## Notificaciones push (Firebase)

1. En la consola de Firebase, crear un proyecto y una app Android con paquete `app.doctordeck`.
   Descargar `google-services.json` → secreto `GOOGLE_SERVICES_JSON_B64` (en base64).
2. Configuración del proyecto › Cuentas de servicio › Generar clave privada (JSON) → en base64 al
   secreto `FCM_SERVICE_ACCOUNT_B64` y ejecutar el workflow **Configurar el VPS** (lo pone como
   `FCM_SERVICE_ACCOUNT` en el `.env` del servidor).
