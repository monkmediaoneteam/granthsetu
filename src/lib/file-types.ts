// The file types a book can be delivered as. Each book is one file, served with its own content type.
// Only PDFs get the licence page stamped on them.
export const FILE_TYPES = {
  pdf: { label: "PDF", extensions: ["pdf"], contentType: "application/pdf", watermark: true },
  epub: { label: "EPUB", extensions: ["epub"], contentType: "application/epub+zip", watermark: false },
} as const;

export type FileType = keyof typeof FILE_TYPES;
export const FILE_TYPE_KEYS = Object.keys(FILE_TYPES) as FileType[];
export const FILE_TYPE_LIST = FILE_TYPE_KEYS.map((key) => FILE_TYPES[key].label).join(", ");
export const FILE_ACCEPT = FILE_TYPE_KEYS.flatMap((key) => FILE_TYPES[key].extensions.map((ext) => `.${ext}`)).join(",");

// Content types a book file may be uploaded as (the browser's claim is only a hint; the bytes are checked too).
export const PRODUCT_FILE_CONTENT_TYPES = ["application/pdf", "application/epub+zip", "application/octet-stream"];

export function normaliseFileType(value: unknown): FileType | null {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (FILE_TYPE_KEYS as string[]).includes(key) ? (key as FileType) : null;
}

export function fileTypeFromName(name: string): FileType | null {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return FILE_TYPE_KEYS.find((key) => (FILE_TYPES[key].extensions as readonly string[]).includes(ext)) ?? null;
}
