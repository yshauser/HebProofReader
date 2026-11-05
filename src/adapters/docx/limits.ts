export interface DocxLimits {
  /** Maximum size of the uploaded file in bytes. */
  maxFileBytes: number;
  /** Maximum number of ZIP entries. */
  maxEntries: number;
  /** Maximum uncompressed size of any single XML part we read. */
  maxPartBytes: number;
}

export const DEFAULT_DOCX_LIMITS: DocxLimits = {
  maxFileBytes: 10 * 1024 * 1024,
  maxEntries: 2000,
  maxPartBytes: 50 * 1024 * 1024,
};
