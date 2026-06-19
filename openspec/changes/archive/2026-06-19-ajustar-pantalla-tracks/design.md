# Design: Adapt tracks screen to match design mockup

## Components and Layout

- **Header**: Centered "TRACKS" title using `ThemedText` with font family matching the application theme.
- **Search bar**: A container with styling `bg-backgroundSelected/50 border border-border/10 rounded-xl flex-row items-center px-4 py-3`. The input field is a `TwTextInput` with placeholder "Buscar tracks...".
- **Filter Tag Carousel/Wrap**: A horizontal container displaying tags: "Todas", "Aves", "Historias", "Paisajes", "Poemas", "Comunidad", "Infancias".
- **Tracks List**: A vertical layout inside a scroll container containing track rows.
- **Track Row**:
  - Image thumbnail: A square `TwImage` with rounded corners.
  - Text detail stack: Title (`ThemedText` bold/black), Category (`ThemedText` secondary/small), Duration (`ThemedText` secondary/small).
  - Actions: An `Icon` representing a vertical menu (`ellipsis.vertical` or `more_vert`).
