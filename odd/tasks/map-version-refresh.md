# Map version: refresh on resume, and show what is loaded

Cierra el reporte de campo: una versión nueva del mapa no llegó al teléfono hasta borrar los datos de la app. Dos entregables: `/config` deja de quedarse viejo, y la hoja de capas dice qué versión está cargada.

## Specs

S1 — El reporte, verbatim: "desplegue una version nueva y se ven bien el mapa nuevo con los nombres por defecto en mobile android, pero hubo un problema. no funciono ver el mapa nuevo, tuve que borrar los datos de la app para que refresque lo cacheado y vea lo nuevo. habria probardo matar la app y no e veia el mapa nuevo"

S2 — La confirmación, verbatim: "solo tube re hacer el reset de los datos de la app, con eso ya cargo la ultima version subida y no la anterior"

S3 — El pedido, verbatim: "corrijamos, pero también se podria hacer que en el boton del mapa se muestre la versoin del mapa cargado? así puedo saber que versoin esta bien en la app"

S4 — La ubicación elegida, verbatim (opción y preview): "Dentro del control de capas" / "Mapa: v7 · archive 908 KB". La versión se lee al abrir la hoja de capas; nada nuevo se dibuja sobre el mapa.

S5 — La pregunta que fija el alcance, verbatim: "como se puede hacer cuando se reinicia la app?" ⇒ reiniciar la app tiene que alcanzar: el arranque en frío reintenta en vez de rendirse, y el caso "la app vuelve del background sin proceso nuevo" también se revalida.

S6 — El diagnóstico medido en el repo: `/config` se pide una sola vez por proceso (`apps/mobile/src/app/_layout.tsx:93`), con 3 s de presupuesto (`remote-config-store.ts:16`), y un abort deja la config anterior sin reintento (`remote-config-store.ts:170-175`); `refetch()` existe (`:202`) y ningún componente lo llama. Todo lo demás está versionado: el archivo en disco lleva la versión en el nombre (`map-archives.ts:99-101`) y el estilo se cachea por huella de URL (`map-style-cache.ts:41-49`), así que una `/config` vieja es la única causa posible de que el mapa quede viejo.

S7 — Pedido posterior, verbatim: "se podria poner la version tmabien el mensaje de la imagen? OpenStreetMap contributors (vXXX)". Decisión de forma, verbatim: la atribución se lee "© OpenStreetMap contributors (v7)" — la versión adentro del mismo cartel, sin traducir el texto legal ni agregar separadores. Se entrega en el mismo PR que S3/S4.

S8 — La atribución no se inventa: el aviso base sale del documento de estilo que el dispositivo ya dibuja (`sources.basemap.attribution`), y la app sólo le agrega ` (vN)` con la misma versión que resolvió para el source. Sin versión parseable no hay sufijo — nunca `(v?)` ni `(v0)`.

## Tasks

| ID  | Qué                                                                                                                                                                                 | Specs          | Ruta     | Commit                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------- | ------------------------------------------------------------------------------------------------ |
| T1  | `/config` se revalida: refetch al volver al foreground con piso anti-spam, `fetchedAt` persistido con caducidad, presupuesto mayor y reintento con backoff cuando la corrida aborta | S1, S2, S5, S6 | worker A | `51ec8c8` · `fix(mobile): revalidate the remote config instead of trusting one cold-start fetch` |
| T2  | La hoja de capas muestra la versión del mapa cargado (`Mapa: v7 · archive 908 KB`), con las claves de traducción donde el repo las mantiene                                         | S3, S4         | worker B | `6a20dda` · `feat(map): name the loaded map version in the layers sheet`                         |

## Log

L1 — "desplegue una version nueva y se ven bien el mapa nuevo con los nombres por defecto en mobile android, pero hubo un problema. no funciono ver el mapa nuevo, tuve que borrar los datos de la app para que refresque lo cacheado y vea lo nuevo. habria probardo matar la app y no e veia el mapa nuevo"

L2 — "solo tube re hacer el reset de los datos de la app, con eso ya cargo la ultima version subida y no la anterior"

L3 — "corrijamos, pero también se podria hacer que en el boton del mapa se muestre la versoin del mapa cargado? así puedo saber que versoin esta bien en la app"

L4 — Decisión de alcance: la versión se muestra dentro del control de capas (no como badge sobre el mapa ni tras long-press), y el arreglo cubre también el arranque en frío: "como se puede hacer cuando se reinicia la app?".

L5 — Entrega: una sola rama y un solo PR por pedido explícito ("todo en el mismo pr"). El PR suma 1036 líneas autoradas en tres work units — `40c0e04` (etiquetas, #641), `51ec8c8` (config, #644) y `6a20dda` (versión en la hoja, #644) — por encima del slice de ~400, así que la revisión se apoya en el corte por unidad de commit en lugar de en PRs encadenados; el gate humano 🥦 se resetea con cada push.

L6 — "se podria poner la version tmabien el mensaje de la imagen? OpenStreetMap contributors (vXXX)". Forma elegida: `© OpenStreetMap contributors (v7)`. Se suma al PR ya abierto por pedido del dueño, así que el gate 🥦 y la revisión del candidato se resetean otra vez.
