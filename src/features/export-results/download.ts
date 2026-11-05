/** Offers `content` as a new file download. Always a new file; the object URL is released right away. */
export function downloadFile(fileName: string, content: string | Uint8Array, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([typeof content === "string" ? content : new Uint8Array(content)], { type: mimeType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(fileName: string, content: string, mimeType: string): void {
  downloadFile(fileName, content, `${mimeType};charset=utf-8`);
}
