import { Buffer } from 'node:buffer';

const CRC32_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC32_TABLE.length; index += 1) {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  CRC32_TABLE[index] = crc >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function toUtf8Bytes(value: string): Uint8Array {
  return Buffer.from(value, 'utf-8');
}

interface ZipEntryInput {
  readonly name: string;
  readonly content: Uint8Array;
}

interface PreparedZipEntry {
  readonly fileName: Buffer;
  readonly fileContent: Buffer;
  readonly checksum: number;
}

function prepareZipEntry(entry: ZipEntryInput): PreparedZipEntry {
  const fileName = Buffer.from(entry.name, 'utf-8');
  const fileContent = Buffer.from(entry.content);
  return {
    fileName,
    fileContent,
    checksum: crc32(fileContent),
  };
}

function createLocalHeader(prepared: PreparedZipEntry): Buffer {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt32LE(prepared.checksum, 14);
  header.writeUInt32LE(prepared.fileContent.length, 18);
  header.writeUInt32LE(prepared.fileContent.length, 22);
  header.writeUInt16LE(prepared.fileName.length, 26);
  header.writeUInt16LE(0, 28);
  return header;
}

function createCentralHeader(prepared: PreparedZipEntry, localOffset: number): Buffer {
  const header = Buffer.alloc(46);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt16LE(0, 12);
  header.writeUInt16LE(0, 14);
  header.writeUInt32LE(prepared.checksum, 16);
  header.writeUInt32LE(prepared.fileContent.length, 20);
  header.writeUInt32LE(prepared.fileContent.length, 24);
  header.writeUInt16LE(prepared.fileName.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(localOffset, 42);
  return header;
}

function createEndOfCentralDirectory(
  entryCount: number,
  centralSize: number,
  centralOffset: number
): Buffer {
  const footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50, 0);
  footer.writeUInt16LE(0, 4);
  footer.writeUInt16LE(0, 6);
  footer.writeUInt16LE(entryCount, 8);
  footer.writeUInt16LE(entryCount, 10);
  footer.writeUInt32LE(centralSize, 12);
  footer.writeUInt32LE(centralOffset, 16);
  footer.writeUInt16LE(0, 20);
  return footer;
}

export function createStoredZip(entries: readonly ZipEntryInput[]): Uint8Array {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const prepared = prepareZipEntry(entry);
    const localHeader = createLocalHeader(prepared);
    const centralHeader = createCentralHeader(prepared, localOffset);

    localParts.push(localHeader, prepared.fileName, prepared.fileContent);
    centralParts.push(centralHeader, prepared.fileName);

    localOffset += localHeader.length + prepared.fileName.length + prepared.fileContent.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endOfCentralDirectory = createEndOfCentralDirectory(
    entries.length,
    centralSize,
    localOffset
  );

  return Buffer.concat([...localParts, ...centralParts, endOfCentralDirectory]);
}
