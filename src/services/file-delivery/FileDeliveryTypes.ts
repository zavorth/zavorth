import type fs from 'fs';

export type RootKey = string;
export type SelectionAction = 'send' | 'list';

export type SearchRoot = {
  key: RootKey;
  label: string;
  absolutePath: string;
};

export type TimeFilter = {
  sinceMs: number | null;
  untilMs: number | null;
  label: string | null;
};

export type FileDeliveryEntry = {
  absolutePath: string;
  baseName: string;
  extension: string;
  isDirectory: boolean;
  relativePath: string;
  rootKey: RootKey;
  rootLabel: string;
  score: number;
  sizeBytes: number;
  modifiedAtMs: number;
};

export type FileDeliveryPlan =
  | { kind: 'send'; entry: FileDeliveryEntry; sendPath: string; fileName: string; caption: string; previewText: string; cleanupPath?: string }
  | { kind: 'choices'; prompt: string; entries: FileDeliveryEntry[] }
  | { kind: 'permission'; requestedPath: string; previewPath: string; originalRequest: string; reason: string }
  | { kind: 'message'; text: string };

export type PendingSelection = {
  createdAtMs: number;
  entries: FileDeliveryEntry[];
  originalRequest: string;
  selectionAction: SelectionAction;
};

export type RequestDescriptor = {
  explicitPath: string | null;
  preferredRoots: RootKey[];
  desiredType: 'file' | 'directory' | 'either';
  desiredExtension: string | null;
  searchTerm: string;
  wantsLatest: boolean;
  wantsListing: boolean;
  modifiedSinceMs: number | null;
  modifiedUntilMs: number | null;
  timeFilterLabel: string | null;
};

export type FileDeliveryPrepareOptions = {
  extraAllowedPaths?: string[];
};

export type FileDeliveryStats = fs.Stats;

export const MAX_TELEGRAM_DOCUMENT_BYTES = 45 * 1024 * 1024;
export const MAX_PENDING_CHOICES = 8;
export const MAX_SCAN_ENTRIES = 4000;
export const MAX_ZIP_FILES = 300;
export const PENDING_SELECTION_TTL_MS = 10 * 60 * 1000;
export const GENERATED_DIRECTORY_NAMES = new Set(['.git', '.next', 'build', 'coverage', 'dist', 'node_modules', 'tmp']);
export const STOPWORDS = new Set([
  'access', 'find', 'now', 'file', 'files', 'search', 'lookup', 'where', 'content', 'of',
  'in', 'the', 'and', 'on', 'locate', 'find', 'send', 'send', 'that', 'this', 'is', 'please',
  'today', 'list', 'listing', 'list', 'localize', 'send', 'more', 'most', 'month', 'my', 'show',
  'showing', 'in', 'the', 'from', 'new', 'the', 'look', 'yesterday', 'the', 'or', 'folder', 'folders', 'pdf',
  'for', 'to', 'search', 'search', 'which', 'what', 'that', 'recent', 'week', 'maybe', 'has', 'type', 'last',
  'last', 'last', 'last', 'last', 'a', 'one',
]);
