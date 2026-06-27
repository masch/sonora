# Specifications: Mejoras de legibilidad en el listado de Trips y Tracks

## Functional Requirements

- En la pantalla de listado de experiencias (`ExperiencesScreen`), cada fila (trip o track) debe mostrarse dentro de un contenedor tipo tarjeta (card) con un fondo sólido y bordes redondeados.
- El color de fondo del card debe coincidir con el correspondiente al tipo de experiencia en la Home (color verde agua para trips, azul para tracks).
- Todos los textos dentro de la tarjeta (título, descripción, duración) deben ser de colores oscuros con alto contraste y legibilidad frente al fondo de la tarjeta.

## Non-Functional Requirements

- Consistencia estética: debe respetar los colores definidos en la paleta global (`RuntimeColors` / theme de Tailwind).
- Accesibilidad: el contraste debe ser lo suficientemente alto para asegurar la lectura adecuada de la información de la experiencia.
