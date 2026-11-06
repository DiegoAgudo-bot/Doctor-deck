# Ficha de Google Play

Todo lo que pide Play Console para publicar la app, listo para copiar. Las imágenes se generan con
`npx tsx scripts/make-store-graphics.tsx` (`icon-512.png` y `feature-graphic.png`). Las capturas
de pantalla se hacen desde el móvil (mínimo 2, recomendable 4–8, en vertical).

> Reglas de la casa: sin nombres de otras webs o apps en lo que se ve (ver `CLAUDE.md`). En la
> tienda además es política de Google: no usar marcas ajenas como palabras clave.

## Ficha principal (es-ES)

**Nombre de la app** (máx. 30): `Doctor Deck: mazos Commander`

**Descripción breve** (máx. 80):

```
Mejora tus mazos de Commander con tu colección: cambios 1×1, escáner y precios.
```

**Descripción completa** (máx. 4000):

```
Doctor Deck te dice qué cambiar en tus mazos de Commander usando las cartas que YA tienes.

Pega tu lista o el enlace de un mazo público y Doctor Deck la compara con lo que juega la comunidad con tu comandante: te propone cambios 1×1 («quita esta → mete esta»), primero con cartas de tu colección que no estén ya en otro de tus mazos, y te explica por qué.

TU COLECCIÓN, SIEMPRE A MANO
• Escanea tus cartas con la cámara: reconoce la edición y el número, también en español y otros idiomas.
• Importa el CSV de tu app de colección o añade cartas a mano, con edición, foil, idioma y estado.
• Valor de la colección con precios de referencia del mercado europeo e histórico de cada carta.
• Filtra como quieras: colores, tipo, rol, rareza, edición, precio…

MAZOS QUE MEJORAN SOLOS
• Cambios sugeridos según la comunidad, tu colección y los roles del mazo (ramp, robo, removal…).
• Qué te falta y cuánto cuesta, con alternativas más baratas.
• Combos del mazo y los que están a una carta.
• Bracket estimado, curva de maná y probabilidades de la mano inicial.
• Crea un mazo desde un comandante: el mazo medio de la comunidad, solo con tus cartas o vacío.

PARA JUGAR CON TU GRUPO
• Contador de vidas con daño de comandante, veneno y turnos.
• Grupos de juego con clasificación y partidas registradas.
• ¿Quién tiene esa carta? Pide prestado y lleva la cuenta de los préstamos.
• Intercambios: listas de deseos, cruces automáticos y propuestas cuadradas por valor.

Gratis y sin anuncios. Tu colección también está en la web: doctordeck.app

Doctor Deck es contenido de fans no oficial permitido por la Política de contenido de fans de Wizards of the Coast. No está aprobado ni respaldado por Wizards. Partes de los materiales usados son propiedad de Wizards of the Coast. ©Wizards of the Coast LLC.
```

**Notas de la versión** (cada subida; máx. 500):

```
Primera versión pública: colección con escáner, mazos con cambios sugeridos, contador de vidas, grupos e intercambios.
```

## Datos de contacto y categoría

- Categoría: **Entretenimiento** (etiquetas: cartas, colección).
- Email de contacto: el de `LEGAL_EMAIL`. Web: `https://doctordeck.app`.
- Política de privacidad: `https://doctordeck.app/privacy`.

## Contenido de la app (Play Console › Política › Contenido de la app)

| Apartado                   | Respuesta                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| Política de privacidad     | `https://doctordeck.app/privacy`                                                                 |
| Anuncios                   | **No** contiene anuncios                                                                         |
| Acceso a la app            | Partes restringidas: da una **cuenta de prueba** (email + contraseña) con colección y algún mazo |
| Público objetivo           | **16 años o más** (no está pensada para menores: evita la política de Familias)                  |
| Aplicación de noticias     | No                                                                                               |
| Apps gubernamentales       | No                                                                                               |
| Funciones financieras      | Ninguna                                                                                          |
| Salud                      | Ninguna                                                                                          |
| Borrado de la cuenta       | Sí, desde la app; URL pública: `https://doctordeck.app/delete-account`                           |
| Clasificación de contenido | Cuestionario IARC: ver abajo                                                                     |
| Seguridad de los datos     | Ver abajo                                                                                        |

### Cuestionario de clasificación (IARC)

- Categoría: **Todas las demás apps** (no es un juego: es una herramienta para un juego de cartas).
- Violencia, sexo, lenguaje, drogas, apuestas: **No** en todo.
- ¿Los usuarios pueden interactuar o intercambiar contenido? **Sí** (comentarios en mazos,
  perfiles públicos y grupos). Hay moderación: denunciar y bloquear.
- ¿Comparte la ubicación? **No**. ¿Compras digitales? **No**.

### Seguridad de los datos

Generales: los datos se **cifran en tránsito** (HTTPS) · el usuario **puede pedir que se borren**
(en la app y en `/delete-account`) · **no se comparten** con terceros (los proveedores que trabajan
para nosotros —alojamiento, email, Firebase— no cuentan como compartir).

| Tipo de dato (Play)                                                                          | ¿Se recoge?                                                         | Obligatorio | Para qué                        |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------- | ------------------------------- |
| Información personal › Email                                                                 | Sí                                                                  | Sí          | Gestión de la cuenta            |
| Información personal › Nombre                                                                | Sí                                                                  | No          | Gestión de la cuenta, funciones |
| Información personal › IDs de usuario                                                        | Sí (nombre de usuario)                                              | Sí          | Funciones de la app, cuenta     |
| Fotos y vídeos                                                                               | **No** (la cámara se procesa en el móvil y la imagen no sale de él) | —           | —                               |
| Actividad › Otro contenido del usuario                                                       | Sí (colección, mazos, comentarios)                                  | Sí          | Funciones de la app             |
| Info. y rendimiento › Registros de fallos                                                    | Sí                                                                  | Sí          | Analíticas (arreglar errores)   |
| Info. y rendimiento › Diagnósticos                                                           | Sí (navegador/versión al fallar)                                    | Sí          | Analíticas                      |
| IDs de dispositivo u otros                                                                   | Sí (token de notificaciones)                                        | No          | Funciones de la app (push)      |
| Ubicación, contactos, finanzas, salud, mensajes, audio, archivos, calendario, navegación web | No                                                                  | —           | —                               |

> Si algún día se añaden anuncios o analítica de terceros, hay que actualizar esta tabla y la
> política de privacidad **antes** de publicar esa versión.

## Subida automática desde GitHub (opcional)

El workflow **App móvil** compila el AAB en cada push a `main`. Para que además lo suba solo a la
prueba interna:

1. Google Cloud Console (el mismo proyecto que Firebase sirve) › IAM › Cuentas de servicio ›
   crear una y generar una clave JSON. Activar la **Google Play Android Developer API**.
2. Play Console › Usuarios y permisos › Invitar a esa cuenta (el email `…iam.gserviceaccount.com`)
   con permiso sobre la app para **publicar en pistas de prueba**.
3. GitHub › Settings › Secrets › `PLAY_SERVICE_ACCOUNT_JSON` = el JSON tal cual.
4. La primera versión se sube a mano. Mientras la app no esté publicada, las subidas quedan como
   **borrador** (variable del repositorio `PLAY_RELEASE_STATUS`: cámbiala a `completed` cuando ya
   esté publicada; `PLAY_TRACK` elige la pista, `internal` por defecto).

## Enlaces que abren la app (App Links)

Play Console › Integridad de la app › **Firma de apps**: copia la huella **SHA-256** del
«certificado de la clave de firma de apps» (y la del «certificado de la clave de subida», si
también instalas el APK a mano) en `ANDROID_CERT_SHA256` del servidor (separadas por comas; con el
workflow «Configurar el VPS», secreto del mismo nombre). Comprobar:
`https://doctordeck.app/.well-known/assetlinks.json` debe listar las huellas.
