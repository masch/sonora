# Delta for Tracks Library

## MODIFIED Requirements

### Requirement: SearchAndFilter

La interfaz debe permitir al usuario buscar y filtrar la lista unificada de experiencias (Tracks y Trips) ingresando texto en un campo de búsqueda, tocando un tag de categoría, o filtrando por tipo de experiencia.
(Previously: La interfaz debe permitir al usuario buscar tracks ingresando texto en un campo de búsqueda, o tocando un tag de categoría.)

#### Scenario: Filter by Category

- GIVEN the user is on the Experiences list screen
- WHEN the user taps on "Aves" category tag
- THEN only experiences categorized as "Aves" MUST be displayed in the list.

#### Scenario: Search by Text Query

- GIVEN the user is on the Experiences list screen
- WHEN the user inputs "Azul" in the search bar
- THEN only experiences whose title or category contains "Azul" MUST be displayed.

#### Scenario: Filter by Experience Type

- GIVEN the user is on the Experiences list screen
- WHEN the user toggles the filter to "Trips"
- THEN only experiences of type "trip" MUST be displayed.
- WHEN the user toggles the filter to "Tracks"
- THEN only experiences of type "track" MUST be displayed.
