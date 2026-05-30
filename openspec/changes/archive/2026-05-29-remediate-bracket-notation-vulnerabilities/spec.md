# Spec: Remediate Bracket Notation Vulnerabilities

## Requirements

1. Eliminate all dynamic object lookups on `RuntimeColors` based on `useColorScheme()`.
2. Guard lookups on `typeClassMap` and `colorClassMap` in `ThemedText` to ensure only own properties are resolved.
3. Ensure no behavior or layout degradation.
4. Pass all unit tests.
