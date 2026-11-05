import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { indexDocument, runUnits } from "../../src/adapters/docx/ooxml";
import { elementChildren, isW, parseXml, serializeXml, W } from "../../src/adapters/docx/xml";

export const readFixture = (name: string) => new Uint8Array(readFileSync(join(process.cwd(), "tests", "fixtures", "docx", `${name}.docx`)));

export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export async function readPart(bytes: Uint8Array, name: string): Promise<string> {
  const file = (await JSZip.loadAsync(bytes)).file(name);
  if (!file) throw new Error(`missing part ${name}`);
  return file.async("string");
}

export async function partNames(bytes: Uint8Array): Promise<string[]> {
  return Object.keys((await JSZip.loadAsync(bytes)).files).sort();
}

export const documentIndex = async (bytes: Uint8Array) => indexDocument(parseXml(await readPart(bytes, "word/document.xml")));

/** Text covered by each comment id, from the comment range markers in document order. */
export async function anchoredTexts(bytes: Uint8Array): Promise<Map<string, string>> {
  const doc = parseXml(await readPart(bytes, "word/document.xml"));
  const active = new Set<string>();
  const result = new Map<string, string>();
  const append = (text: string) => {
    for (const id of active) result.set(id, (result.get(id) ?? "") + text);
  };
  const walk = (el: Element) => {
    for (const child of elementChildren(el)) {
      const id = child.getAttributeNS(W, "id") ?? "";
      if (isW(child, "commentRangeStart")) {
        active.add(id);
        result.set(id, result.get(id) ?? "");
      } else if (isW(child, "commentRangeEnd")) active.delete(id);
      else if (isW(child, "p")) {
        append("\n");
        walk(child);
      } else if (isW(child, "r")) append(runUnits(child).map((u) => u.text).join(""));
      else walk(child);
    }
  };
  const body = elementChildren(doc.documentElement).find((c) => isW(c, "body"));
  if (body) {
    // The first paragraph does not start with a separator.
    let first = true;
    const walkBody = (el: Element) => {
      for (const child of elementChildren(el)) {
        if (isW(child, "p")) {
          if (!first) append("\n");
          first = false;
          walk(child);
        } else walkBody(child);
      }
    };
    walkBody(body);
  }
  return result;
}

const attributeKey = (el: Element) =>
  Array.from(el.attributes)
    .map((a) => `${a.name}=${a.value}`)
    .sort()
    .join(",");

/**
 * Canonical form of document.xml that ignores what comment insertion legitimately changes:
 * comment markers/reference runs are removed and adjacent text-only runs with identical
 * formatting are merged. Used to prove that structure and formatting are retained.
 */
export function canonicalDocument(xml: string): string {
  const doc = parseXml(xml);
  for (const name of ["commentRangeStart", "commentRangeEnd"]) {
    for (const el of Array.from(doc.getElementsByTagNameNS(W, name))) el.parentNode?.removeChild(el);
  }
  for (const ref of Array.from(doc.getElementsByTagNameNS(W, "commentReference"))) {
    const run = ref.parentNode;
    if (run && isW(run, "r")) run.parentNode?.removeChild(run);
  }
  const textOnly = (run: Element) => elementChildren(run).every((c) => isW(c, "rPr") || isW(c, "t"));
  const formatKey = (run: Element) => {
    const rPr = elementChildren(run).find((c) => isW(c, "rPr"));
    return `${attributeKey(run)}|${rPr ? serializeXml(rPr as unknown as Document) : ""}`;
  };
  const merge = (parent: Element) => {
    for (const child of elementChildren(parent)) merge(child);
    let node: Node | null = parent.firstChild;
    while (node) {
      const next: Node | null = node.nextSibling;
      if (isW(node, "r") && next && isW(next, "r") && textOnly(node as Element) && textOnly(next as Element) && formatKey(node as Element) === formatKey(next as Element)) {
        for (const t of elementChildren(next as Element).filter((c) => isW(c, "t"))) (node as Element).appendChild(t);
        parent.removeChild(next);
        continue;
      }
      node = next;
    }
  };
  merge(doc.documentElement);
  for (const run of Array.from(doc.getElementsByTagNameNS(W, "r"))) {
    const texts = elementChildren(run).filter((c) => isW(c, "t"));
    if (texts.length === 0 || !textOnly(run)) continue;
    const first = texts[0];
    if (!first) continue;
    const joined = texts.map((t) => t.textContent ?? "").join("");
    for (const t of texts.slice(1)) run.removeChild(t);
    first.textContent = joined;
    first.setAttribute("xml:space", "preserve");
  }
  return serializeXml(doc);
}
