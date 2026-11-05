import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import { DocxError } from "./errors";

export const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
export const XML_NS = "http://www.w3.org/XML/1998/namespace";

/**
 * Parses an XML part. OOXML never needs a DTD, so any DOCTYPE/ENTITY declaration is rejected
 * before parsing (entity-expansion and external-entity attacks). Parser diagnostics are never
 * printed because they may quote document content.
 */
export function parseXml(xml: string): Document {
  if (/<!(DOCTYPE|ENTITY)/i.test(xml)) throw new DocxError("unsafe-xml");
  try {
    const parser = new DOMParser({
      onError: (level) => {
        if (level !== "warning") throw new DocxError("invalid-xml");
      },
    });
    return parser.parseFromString(xml, "text/xml") as unknown as Document;
  } catch (error) {
    throw error instanceof DocxError ? error : new DocxError("invalid-xml");
  }
}

export const serializeXml = (doc: Document): string => new XMLSerializer().serializeToString(doc as never);

export const isW = (node: Node | null, name: string): boolean =>
  node !== null && node.nodeType === 1 && (node as Element).namespaceURI === W && (node as Element).localName === name;

export const elementChildren = (el: Element): Element[] =>
  Array.from(el.childNodes).filter((n): n is Element => n.nodeType === 1);

export function wElement(doc: Document, name: string, attrs: Record<string, string> = {}): Element {
  const el = doc.createElementNS(W, `w:${name}`);
  for (const [key, value] of Object.entries(attrs)) el.setAttributeNS(W, `w:${key}`, value);
  return el;
}
