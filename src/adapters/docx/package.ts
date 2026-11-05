import JSZip from "jszip";
import { DocxError } from "./errors";
import { DEFAULT_DOCX_LIMITS } from "./limits";
import type { DocxLimits } from "./limits";
import { validateSignature } from "./validate";
import { parseXml } from "./xml";

export const MAIN_PART = "word/document.xml";
export const CONTENT_TYPES_PART = "[Content_Types].xml";
const MAIN_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

interface InternalStream {
  on(event: "data", handler: (chunk: Uint8Array) => void): InternalStream;
  on(event: "end", handler: () => void): InternalStream;
  on(event: "error", handler: (error: unknown) => void): InternalStream;
  pause(): InternalStream;
  resume(): InternalStream;
}

/** Reads the raw bytes of a part, aborting as soon as the decompressed size exceeds `maxBytes`. */
function readLimited(file: JSZip.JSZipObject, maxBytes: number): Promise<Uint8Array> {
  const stream = (file as unknown as { internalStream?: (type: "uint8array") => InternalStream }).internalStream?.("uint8array");
  if (!stream) return Promise.reject(new DocxError("corrupt-package"));
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0;
    stream
      .on("data", (chunk) => {
        size += chunk.length;
        if (size > maxBytes) {
          stream.pause();
          reject(new DocxError("part-too-large"));
          return;
        }
        chunks.push(chunk);
      })
      .on("error", () => reject(new DocxError("corrupt-package")))
      .on("end", () => {
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        resolve(bytes);
      })
      .resume();
  });
}

export interface DocxPackage {
  zip: JSZip;
  limits: DocxLimits;
  has(name: string): boolean;
  names(): string[];
  /** Reads a part as UTF-8 text with a hard decompressed-size limit. Returns undefined when absent. */
  readText(name: string): Promise<string | undefined>;
}

/**
 * Opens and validates a .docx package from untrusted bytes. The input is never modified.
 * Rejects non-ZIP, legacy/encrypted (OLE), oversized, macro-enabled and malformed packages.
 */
export async function openDocxPackage(bytes: Uint8Array, limits: DocxLimits = DEFAULT_DOCX_LIMITS): Promise<DocxPackage> {
  validateSignature(bytes, limits);
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new DocxError("corrupt-package");
  }
  if (Object.keys(zip.files).length > limits.maxEntries) throw new DocxError("too-many-entries");

  const pkg: DocxPackage = {
    zip,
    limits,
    has: (name) => zip.file(name) !== null,
    names: () => Object.keys(zip.files),
    async readText(name) {
      const file = zip.file(name);
      if (!file) return undefined;
      const raw = await readLimited(file, limits.maxPartBytes);
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(raw);
      } catch {
        throw new DocxError("invalid-xml");
      }
    },
  };

  const contentTypes = await pkg.readText(CONTENT_TYPES_PART);
  if (contentTypes === undefined || !pkg.has(MAIN_PART)) throw new DocxError("missing-main-part");
  const types = parseXml(contentTypes);
  const main = Array.from(types.getElementsByTagName("Override")).find((el) => el.getAttribute("PartName") === `/${MAIN_PART}`);
  if (main?.getAttribute("ContentType") !== MAIN_CONTENT_TYPE) throw new DocxError("unsupported-package");
  return pkg;
}

export const RELS_PART = "word/_rels/document.xml.rels";
export const COMMENTS_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";

/** Resolves a relationship target (relative to word/ unless absolute) to a package part name. */
export function resolveTarget(target: string): string {
  const parts = (target.startsWith("/") ? target.slice(1) : `word/${target}`).split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== "." && part !== "") resolved.push(part);
  }
  return resolved.join("/");
}

/** Name of the existing comments part, found through the document relationships (not assumed). */
export async function findCommentsPartName(pkg: DocxPackage): Promise<string | undefined> {
  const rels = await pkg.readText(RELS_PART);
  if (rels === undefined) return undefined;
  const rel = Array.from(parseXml(rels).getElementsByTagName("Relationship")).find((el) => el.getAttribute("Type") === COMMENTS_REL_TYPE);
  const target = rel?.getAttribute("Target");
  return target ? resolveTarget(target) : undefined;
}
