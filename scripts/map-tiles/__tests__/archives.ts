/**
 * Byte-level fixtures for the map-tiles tests: a structurally valid zip, its JAR variant, and
 * the first blob of an OSM PBF file.
 *
 * They are built by hand — 60 lines instead of a fixture directory — because the checks under
 * test read structure, not contents: a zip's central directory and a PBF's first blob.
 */
import { writeFileSync } from 'node:fs';

/**
 * A single-entry zip, stored (not deflated) and with a zero CRC.
 *
 * Structure is exactly what `zipProblem` and `jarProblem` read: local header, central
 * directory, end record. CRCs are not checked there, because verifying a 900 MB member's CRC
 * costs more than the truncation it would catch.
 */
export function storedZip(name: string, content = 'x'): Buffer {
  const fileName = Buffer.from(name, 'utf8');
  const data = Buffer.from(content, 'utf8');

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(fileName.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(fileName.length, 28);
  central.writeUInt32LE(0, 42);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + fileName.length, 12);
  end.writeUInt32LE(local.length + fileName.length + data.length, 16);

  return Buffer.concat([local, fileName, data, central, fileName, end]);
}

/** A zip a JAR check accepts: one member, and it is the manifest. */
export function jarBytes(): Buffer {
  return storedZip('META-INF/MANIFEST.MF', 'Main-Class: com.protomaps.basemap.Basemap\n');
}

/** Writes `jarBytes()` where a build step looks for `*-with-deps.jar`. */
export function writeJar(path: string): void {
  writeFileSync(path, jarBytes());
}

/** The first blob of an OSM PBF file: a blob header whose type is `OSMHeader`. */
export function osmPbfHeader(): Buffer {
  const type = Buffer.from('OSMHeader', 'utf8');
  const header = Buffer.concat([Buffer.from([0x0a, type.length]), type, Buffer.from([0x18, 0x05])]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(header.length, 0);
  return Buffer.concat([length, header, Buffer.alloc(5)]);
}
