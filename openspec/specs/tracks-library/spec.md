# Tracks Library Specification

## Purpose

Definir los requerimientos de interfaz y comportamiento para la biblioteca de tracks en la aplicación móvil, garantizando que el usuario pueda buscar y filtrar pistas por sus categorías correspondientes.

## Requirements

### Requirement: SearchAndFilter

La interfaz debe permitir al usuario buscar tracks ingresando texto en un campo de búsqueda, o tocando un tag de categoría.

#### Scenario: Filter by Category

- GIVEN the user is on the Tracks screen
- WHEN the user taps on "Aves" category tag
- THEN only tracks categorized as "Aves" MUST be displayed in the list.

#### Scenario: Search by Text Query

- GIVEN the user is on the Tracks screen
- WHEN the user inputs "Azul" in the search bar
- THEN only tracks whose title or category contains "Azul" MUST be displayed.
