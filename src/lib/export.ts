export function exportToJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  downloadBlob(new Blob([json], { type: "application/json" }), filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function safeFilename(name: string, extension: string): string {
  const basename = name.trim().replace(/[\\/:*?"<>|\n\r]+/g, "_") || "character";
  return `${basename}${extension}`;
}

export function importFromJson<T>(file: File): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const data = JSON.parse(reader.result as string) as T;
        resolve(data);
      } catch {
        reject(new Error("无效的 JSON 文件"));
      }
    });
    reader.addEventListener("error", () => reject(new Error("读取文件失败")));
    reader.readAsText(file);
  });
}
