const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const TRANSPARENT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=";
const CHUNK_TEXT = "tEXt";
const CHUNK_IEND = "IEND";
const CHARA_KEYWORD = "chara";
const CCV3_KEYWORD = "ccv3";

type PngChunk = {
  type: string;
  data: Uint8Array;
};

export async function readCharaCardFromPng(file: File): Promise<unknown> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const textChunks = parsePng(bytes).flatMap(readTextChunk);
  const payload = findTextPayload(textChunks, CCV3_KEYWORD) ?? findTextPayload(textChunks, CHARA_KEYWORD);

  if (!payload) {
    throw new Error("PNG 中未找到角色卡 metadata");
  }

  return JSON.parse(base64ToUtf8(payload));
}

export async function writeCharaCardToPng(metadata: unknown, sourcePng?: string): Promise<Blob> {
  const bytes = sourcePng ? await pngBytesFromSource(sourcePng) : base64ToBytes(TRANSPARENT_PNG_BASE64);
  const chunks = parsePng(bytes).filter((chunk) => !isCharacterTextChunk(chunk));
  const textChunk = createTextChunk(CHARA_KEYWORD, utf8ToBase64(JSON.stringify(metadata)));
  const insertAt = chunks.findIndex((chunk) => chunk.type === CHUNK_IEND);
  const nextChunks = [...chunks.slice(0, insertAt), textChunk, ...chunks.slice(insertAt)];

  return new Blob([serializePng(nextChunks).buffer as ArrayBuffer], { type: "image/png" });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      resolve(typeof reader.result === "string" ? reader.result : ""),
    );
    reader.addEventListener("error", () => reject(new Error("读取文件失败")));
    reader.readAsDataURL(file);
  });
}

function parsePng(bytes: Uint8Array): PngChunk[] {
  if (!hasPngSignature(bytes)) {
    throw new Error("无效的 PNG 文件");
  }

  const chunks: PngChunk[] = [];
  let offset = PNG_SIGNATURE.length;

  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) {
      throw new Error("无效的 PNG 文件");
    }

    const length = readUint32(bytes, offset);
    const type = latin1Decode(bytes.slice(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const nextOffset = dataEnd + 4;

    if (dataEnd > bytes.length || nextOffset > bytes.length) {
      throw new Error("无效的 PNG 文件");
    }

    chunks.push({ type, data: bytes.slice(dataStart, dataEnd) });
    offset = nextOffset;

    if (type === CHUNK_IEND) break;
  }

  if (!chunks.some((chunk) => chunk.type === CHUNK_IEND)) {
    throw new Error("无效的 PNG 文件");
  }

  return chunks;
}

function serializePng(chunks: PngChunk): Uint8Array;
function serializePng(chunks: PngChunk[]): Uint8Array;
function serializePng(chunks: PngChunk | PngChunk[]): Uint8Array {
  const chunkList = Array.isArray(chunks) ? chunks : [chunks];
  const totalLength = PNG_SIGNATURE.length + chunkList.reduce((sum, chunk) => sum + 12 + chunk.data.length, 0);
  const result = new Uint8Array(totalLength);
  result.set(PNG_SIGNATURE, 0);

  let offset = PNG_SIGNATURE.length;
  for (const chunk of chunkList) {
    writeUint32(result, offset, chunk.data.length);
    writeType(result, offset + 4, chunk.type);
    result.set(chunk.data, offset + 8);

    const crcBytes = result.slice(offset + 4, offset + 8 + chunk.data.length);
    writeUint32(result, offset + 8 + chunk.data.length, crc32(crcBytes));
    offset += 12 + chunk.data.length;
  }

  return result;
}

function createTextChunk(keyword: string, text: string): PngChunk {
  const keywordBytes = latin1Encode(keyword);
  const textBytes = latin1Encode(text);
  const data = new Uint8Array(keywordBytes.length + 1 + textBytes.length);
  data.set(keywordBytes, 0);
  data[keywordBytes.length] = 0;
  data.set(textBytes, keywordBytes.length + 1);
  return { type: CHUNK_TEXT, data };
}

type TextChunk = {
  keyword: string;
  text: string;
};

function readTextChunk(chunk: PngChunk): TextChunk[] {
  if (chunk.type !== CHUNK_TEXT) return [];

  const separator = chunk.data.indexOf(0);
  if (separator < 0) return [];

  return [{
    keyword: latin1Decode(chunk.data.slice(0, separator)),
    text: latin1Decode(chunk.data.slice(separator + 1)),
  }];
}

function findTextPayload(chunks: TextChunk[], keyword: string): string | null {
  return chunks.find((chunk) => chunk.keyword.toLowerCase() === keyword)?.text ?? null;
}

function isCharacterTextChunk(chunk: PngChunk): boolean {
  const [textChunk] = readTextChunk(chunk);
  return textChunk?.keyword.toLowerCase() === CHARA_KEYWORD || textChunk?.keyword.toLowerCase() === CCV3_KEYWORD;
}

async function pngBytesFromSource(source: string): Promise<Uint8Array> {
  const trimmed = source.trim();
  const bytes = trimmed.startsWith("data:") ? bytesFromDataUrl(trimmed) : bytesFromBase64Source(trimmed);
  return hasPngSignature(bytes) ? bytes : base64ToBytes(TRANSPARENT_PNG_BASE64);
}

function bytesFromDataUrl(source: string): Uint8Array {
  const match = /^data:([^;,]+)(?:;[^,]*)*;base64,(.*)$/i.exec(source);
  if (!match || match[1]?.toLowerCase() !== "image/png") {
    return base64ToBytes(TRANSPARENT_PNG_BASE64);
  }

  return base64ToBytes(match[2] ?? "");
}

function bytesFromBase64Source(source: string): Uint8Array {
  try {
    return base64ToBytes(source);
  } catch {
    return base64ToBytes(TRANSPARENT_PNG_BASE64);
  }
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) * 0x1000000 +
      ((bytes[offset + 1] ?? 0) << 16) +
      ((bytes[offset + 2] ?? 0) << 8) +
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function writeType(bytes: Uint8Array, offset: number, type: string): void {
  for (let i = 0; i < 4; i += 1) {
    bytes[offset + i] = type.charCodeAt(i);
  }
}

function latin1Encode(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length);
  for (let i = 0; i < value.length; i += 1) {
    bytes[i] = value.charCodeAt(i) & 0xff;
  }
  return bytes;
}

function latin1Decode(bytes: Uint8Array): string {
  let result = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    result += String.fromCharCode(...bytes.slice(i, i + 0x8000));
  }
  return result;
}

function utf8ToBase64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

function base64ToUtf8(value: string): string {
  return new TextDecoder().decode(base64ToBytes(value));
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
