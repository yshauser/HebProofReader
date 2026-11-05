const MAX_BASE_LENGTH = 80;

/**
 * Name for the generated file: never the source name itself. Path separators, control and
 * reserved characters are removed so the name is safe as a download name.
 */
export function commentedFileName(originalName: string | undefined): string {
  const base = (originalName ?? "")
    .replace(/\.docx$/i, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\\:/*?"<>|\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e]/g, "")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, MAX_BASE_LENGTH)
    .trim();
  return `${base === "" ? "document" : base}.commented.docx`;
}
