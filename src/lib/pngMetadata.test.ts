import { describe, expect, test } from "vitest";
import { readCharaCardFromPng, writeCharaCardToPng } from "@/lib/pngMetadata";

const TRANSPARENT_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=";

describe("png metadata", () => {
  test("writes and reads chara metadata", async () => {
    const metadata = { spec: "chara_card_v2", data: { name: "云雀" } };
    const png = await writeCharaCardToPng(metadata, TRANSPARENT_PNG_DATA_URL);
    const result = await readCharaCardFromPng(fileFromBlob(png, "card.png"));

    expect(result).toEqual(metadata);
  });

  test("keeps the latest chara metadata when writing repeatedly", async () => {
    const first = await writeCharaCardToPng(
      { spec: "chara_card_v2", data: { name: "旧角色" } },
      TRANSPARENT_PNG_DATA_URL,
    );
    const dataUrl = `data:image/png;base64,${await blobToBase64(first)}`;
    const second = await writeCharaCardToPng(
      { spec: "chara_card_v2", data: { name: "新角色" } },
      dataUrl,
    );

    await expect(readCharaCardFromPng(fileFromBlob(second, "card.png"))).resolves.toEqual({
      spec: "chara_card_v2",
      data: { name: "新角色" },
    });
  });

  test("accepts png avatar data URL variants and bare base64", async () => {
    const base64 = TRANSPARENT_PNG_DATA_URL.split(",")[1] ?? "";
    const variants = [
      `data:image/png;charset=utf-8;base64,${base64}`,
      `data:IMAGE/PNG;base64,${base64}`,
      base64,
    ];

    for (const source of variants) {
      const png = await writeCharaCardToPng({ spec: "chara_card_v2", data: { name: "变体" } }, source);
      await expect(readCharaCardFromPng(fileFromBlob(png, "card.png"))).resolves.toEqual({
        spec: "chara_card_v2",
        data: { name: "变体" },
      });
    }
  });

  test("prefers ccv3 metadata over chara metadata", async () => {
    const file = pngWithChunks([
      textChunk("chara", { spec: "chara_card_v2", data: { name: "V2" } }),
      textChunk("ccv3", { spec: "chara_card_v3", data: { name: "V3" } }),
    ]);

    await expect(readCharaCardFromPng(file)).resolves.toEqual({
      spec: "chara_card_v3",
      data: { name: "V3" },
    });
  });

  test("removes old chara and ccv3 metadata when writing", async () => {
    const source = pngWithChunks([
      textChunk("chara", { spec: "chara_card_v2", data: { name: "旧 V2" } }),
      textChunk("ccv3", { spec: "chara_card_v3", data: { name: "旧 V3" } }),
    ]);
    const sourceDataUrl = `data:image/png;base64,${await blobToBase64(source)}`;
    const png = await writeCharaCardToPng({ spec: "chara_card_v2", data: { name: "新 V2" } }, sourceDataUrl);

    await expect(readCharaCardFromPng(fileFromBlob(png, "card.png"))).resolves.toEqual({
      spec: "chara_card_v2",
      data: { name: "新 V2" },
    });
  });

  test("rejects a non-png file", async () => {
    const file = new File(["hello"], "card.txt", { type: "text/plain" });

    await expect(readCharaCardFromPng(file)).rejects.toThrow("无效的 PNG 文件");
  });

  test("rejects a png without chara metadata", async () => {
    const file = fileFromBase64(TRANSPARENT_PNG_DATA_URL, "card.png");

    await expect(readCharaCardFromPng(file)).rejects.toThrow("PNG 中未找到角色卡 metadata");
  });
});

function fileFromBlob(blob: Blob, name: string): File {
  return new File([blob], name, { type: blob.type });
}

function pngWithChunks(chunks: Uint8Array[]): File {
  const bytes = insertChunksAfterIhdr(bytesFromDataUrl(TRANSPARENT_PNG_DATA_URL), chunks);
  return new File([bytes.buffer as ArrayBuffer], "card.png", { type: "image/png" });
}

function textChunk(keyword: "chara" | "ccv3", metadata: unknown): Uint8Array {
  return chunk("tEXt", new Uint8Array([...new TextEncoder().encode(keyword), 0, ...new TextEncoder().encode(metadataPayload(metadata))]));
}

function metadataPayload(metadata: unknown): string {
  return btoa(new TextEncoder().encode(JSON.stringify(metadata)).reduce((text, byte) => text + String.fromCharCode(byte), ""));
}

function fileFromBase64(dataUrl: string, name: string): File {
  const binary = atob(dataUrl.split(",")[1] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], name, { type: "image/png" });
}

function bytesFromDataUrl(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.split(",")[1] ?? "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function insertChunksAfterIhdr(png: Uint8Array, chunks: Uint8Array[]): Uint8Array {
  const ihdrEnd = 8 + 12 + readUint32(png, 8);
  const chunkLength = chunks.reduce((sum, textChunk) => sum + textChunk.length, 0);
  const result = new Uint8Array(png.length + chunkLength);
  result.set(png.slice(0, ihdrEnd), 0);
  let offset = ihdrEnd;
  for (const textChunk of chunks) {
    result.set(textChunk, offset);
    offset += textChunk.length;
  }
  result.set(png.slice(ihdrEnd), offset);
  return result;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const result = new Uint8Array(12 + data.length);
  writeUint32(result, 0, data.length);
  for (let i = 0; i < 4; i += 1) result[4 + i] = type.charCodeAt(i);
  result.set(data, 8);
  writeUint32(result, 8 + data.length, crc32(result.slice(4, 8 + data.length)));
  return result;
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (((bytes[offset] ?? 0) * 0x1000000 + ((bytes[offset + 1] ?? 0) << 16) + ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0)) >>> 0);
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      resolve(typeof reader.result === "string" ? (reader.result.split(",")[1] ?? "") : ""),
    );
    reader.addEventListener("error", () => reject(new Error("读取文件失败")));
    reader.readAsDataURL(blob);
  });
}
