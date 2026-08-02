/**
 * Pure helper functions for the sync-translations script.
 */

/**
 * Flatten a nested object to dot-notation keys.
 * e.g. { common: { learnMore: "..." } } → { "common.learnMore": "..." }
 */
export function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const flatKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[flatKey] = value;
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(result, flatten(value as Record<string, unknown>, flatKey));
    }
  }
  return result;
}

/**
 * Deep-set a value into a nested object from a dot-notation key.
 * e.g. setNested({}, "common.learnMore", "Learn more") → { common: { learnMore: "Learn more" } }
 */
export function setNested(obj: Record<string, unknown>, key: string, value: string): void {
  const parts = key.split('.');
  if (parts.length === 0 || parts.some((part) => part.length === 0)) {
    return;
  }

  const blockedKeys = new Set(['__proto__', 'constructor', 'prototype']);
  if (parts.some((part) => blockedKeys.has(part))) {
    return;
  }

  const lastIdx = parts.length - 1;

  function setAt(node: Record<string, unknown>, idx: number): void {
    if (idx === lastIdx) {
      node[parts[idx]] = value;
      return;
    }
    const part = parts[idx];
    if (
      !Object.hasOwn(node, part) ||
      typeof node[part] !== 'object' ||
      node[part] === null ||
      Array.isArray(node[part])
    ) {
      node[part] = Object.create(null) as Record<string, unknown>;
    }
    setAt(node[part] as Record<string, unknown>, idx + 1);
  }

  setAt(obj, 0);
}

/**
 * Recursively serialize a nested object back to TypeScript source.
 * Matches the format: single quotes, trailing commas, 2-space indent.
 *
 * The first call should use indent=0 (level before the opening `{`).
 * Each child level adds 1 indent (2 spaces).
 */
export function serializeToTS(obj: Record<string, unknown>, indent = 0): string {
  const childPad = '  '.repeat(indent + 1);
  const entries: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Choose delimiters to minimize diff noise and avoid invalid TS:
      // double quotes when value contains single quotes (avoids escaping '),
      // single quotes otherwise. Always escape newlines/backslashes/tabs.
      const useDouble = value.includes("'") && !value.includes('"');
      const quote = useDouble ? '"' : "'";
      const escaped = useDouble
        ? value
            .replace(/\\/g, '\\\\')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
        : value
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
      entries.push(`${childPad}${key}: ${quote}${escaped}${quote},`);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      entries.push(`${childPad}${key}: {`);
      entries.push(serializeToTS(value as Record<string, unknown>, indent + 1));
      entries.push(`${childPad}},`);
    }
  }

  return entries.join('\n');
}

/**
 * Render the full .ts file content from an object.
 * Preserves 2-space indent, as const assertion, and type export.
 */
export function renderTSFile(exportName: string, obj: Record<string, unknown>): string {
  const body = serializeToTS(obj, 0);
  const typeName = `${exportName.charAt(0).toUpperCase()}${exportName.slice(1)}Dict`;
  return `export const ${exportName} = {\n${body}\n} as const;\n\nexport type ${typeName} = typeof ${exportName};\n`;
}

/**
 * Compare two flat maps and return only the differing keys.
 */
export function diffFlat(
  base: Record<string, string>,
  overlay: Record<string, string>,
): Record<string, { base: string; overlay: string }> {
  const result: Record<string, { base: string; overlay: string }> = {};
  for (const [key, value] of Object.entries(overlay)) {
    if (base[key] !== value) {
      result[key] = { base: base[key] ?? '', overlay: value };
    }
  }
  return result;
}
