# Proposal: Normalizar UI de Pantallas al Nivel de la Home

## Motivación

La pantalla principal (Home / `TripMap`) tiene una estética premium, dinámica e inmersiva con fondos de imagen personalizados, banners, y paneles glassmorphic. Sin embargo, las pantallas de `explore`, `settings` y el detalle del viaje (`trip-detail-view`) utilizan colores de fondo planos y contenedores estándar, lo que resulta en una experiencia visual inconsistente.

## Cambios Propuestos

1. Aplicar la imagen de fondo unificada (`fondo-recorridos-sec-1.png`) a todas las pantallas.
2. Crear un banner superior uniforme usando `banner-fondo-logo-1.png` para mantener la coherencia.
3. Envolver todos los contenedores de contenido en paneles glassmorphic (`bg-white/80 backdrop-blur-md rounded-[24px] shadow-md`).
4. Reemplazar todos los elementos de texto genéricos por `ThemedText` con los pesos de fuente (`font-extrabold`, `font-black`, `font-bold`) y colores adecuados (`text-zinc-800`, `text-zinc-600`) alineados con la Home.
5. Asegurar cumplimiento estricto con las reglas de localización (i18n) y accesibilidad.
