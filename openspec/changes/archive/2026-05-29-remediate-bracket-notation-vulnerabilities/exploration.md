# Exploration: Remediate Bracket Notation Vulnerabilities

## Background
The security scanner identified multiple Medium severity findings in components where dynamic bracket notation lookups were being performed. These findings fall under potential Prototype Pollution / Remote Code Execution concerns since dynamic property accesses using unchecked external input could resolve prototype methods (e.g., `toString`, `__proto__`).

## Target Code Analysis

1. `src/app/explore.tsx` (Line 20)
   ```typescript
   const scheme = useColorScheme();
   const colors = RuntimeColors[scheme === 'unspecified' ? 'light' : scheme];
   ```
   - *Risk*: Dynamic lookup using `scheme`.
   - *Solution*: Use a safe ternary operator mapping `scheme === 'dark'` to `RuntimeColors.dark`, defaulting to `RuntimeColors.light`.

2. `src/components/ui/collapsible.tsx` (Line 14)
   - *Risk/Solution*: Same as above.

3. `src/components/app-tabs.tsx` (Line 12)
   - *Risk/Solution*: Same as above.

4. `src/components/themed-text.tsx` (Lines 34-35)
   ```typescript
   const typeClass = typeClassMap[type] ?? typeClassMap.default;
   const colorClass = themeColor ? (colorClassMap[themeColor] ?? 'text-text') : 'text-text';
   ```
   - *Risk*: Props like `type` or `themeColor` could be supplied with prototype keys.
   - *Solution*: Validate own property existence using `Object.prototype.hasOwnProperty.call()` before lookups.

5. Test files & mocks
   - False positive checks on mock objects since they do not execute dynamic code.
