# Specifications: Hardening `setNested` against Prototype Pollution

## Requirements

### Requirement 1: Reject Prototype-Polluting Keys

`setNested` MUST reject any dot-notation key where any path segment equals `__proto__`, `constructor`, or `prototype`.

#### Scenarios

- **Scenario 1.1**: Attempting `setNested(obj, '__proto__.polluted', 'yes')` leaves `obj` empty and does not pollute `Object.prototype`.
- **Scenario 1.2**: Attempting `setNested(obj, 'constructor.prototype.polluted', 'yes')` leaves `obj` empty and does not pollute `Object.prototype`.
- **Scenario 1.3**: Attempting `setNested(obj, 'prototype.polluted', 'yes')` leaves `obj` empty and does not pollute `Object.prototype`.

### Requirement 2: Reject Empty Key Segments

`setNested` MUST gracefully exit without mutating `obj` if the key string is empty or contains empty segments.

#### Scenarios

- **Scenario 2.1**: Attempting `setNested(obj, 'common..dismiss', 'val')` leaves `obj` untouched.
- **Scenario 2.2**: Attempting `setNested(obj, '', 'val')` leaves `obj` untouched.

### Requirement 3: Preserve Valid Nesting Functionality

`setNested` MUST continue to correctly parse and set valid dot-notation nested properties.

#### Scenarios

- **Scenario 3.1**: `setNested({}, 'a.b.c', 'deep')` yields `{ a: { b: { c: 'deep' } } }`.
- **Scenario 3.2**: Setting sibling keys preserves existing keys.
