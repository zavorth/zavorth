import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { logger } from '../logger.js';

type JsonRecord = Record<string, unknown>;

const STORE_DIR = path.join(process.cwd(), "data", "ai-gateway");

function ensureDir() {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function readJson<T>(fileName: string, fallback: T): T {
  try {
    ensureDir();
    const filePath = path.join(STORE_DIR, safeName(fileName));
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(fileName: string, value: unknown) {
  ensureDir();
  const filePath = path.join(STORE_DIR, safeName(fileName));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
}

export type GatewayFileRecord = {
  id: string;
  object: "file";
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  path: string;
};

export type GatewayBatchRecord = {
  id: string;
  object: "batch";
  endpoint: string;
  input_file_id: string;
  completion_window: string;
  status: "validating" | "in_progress" | "completed" | "failed" | "cancelled";
  created_at: number;
  completed_at: number | null;
  error_file_id: string | null;
  output_file_id: string | null;
  request_counts: {
    total: number;
    completed: number;
    failed: number;
  };
  metadata: JsonRecord;
};

export function listGatewayFiles(): GatewayFileRecord[] {
  return readJson<GatewayFileRecord[]>("files.json", []);
}

export function getGatewayFile(id: string): GatewayFileRecord | null {
  return listGatewayFiles().find((file) => file.id === id) || null;
}

export async function createGatewayFile(request: Request): Promise<GatewayFileRecord> {
  ensureDir();
  const form = await request.formData();
  const file = form.get("file");
  const purpose = String(form.get("purpose") || "assistants");
  if (!(file instanceof File)) {
    throw new Error("Expected multipart field 'file'.");
  }
  const id = `file_${crypto.randomBytes(12).toString("hex")}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const filePath = path.join(STORE_DIR, `${id}-${safeName(file.name || "upload.bin")}`);
  fs.writeFileSync(filePath, bytes, { mode: 0o600 });
  const record: GatewayFileRecord = {
    id,
    object: "file",
    bytes: bytes.length,
    created_at: Math.floor(Date.now() / 1000),
    filename: file.name || "upload.bin",
    purpose,
    path: filePath,
  };
  writeJson("files.json", [...listGatewayFiles().filter((item) => item.id !== id), record]);
  return record;
}

export function createGatewayGeneratedFile(input: {
  filename: string;
  purpose: string;
  content: Buffer | string;
}): GatewayFileRecord {
  ensureDir();
  const id = `file_${crypto.randomBytes(12).toString("hex")}`;
  const bytes = Buffer.isBuffer(input.content) ? input.content : Buffer.from(input.content, "utf8");
  const filePath = path.join(STORE_DIR, `${id}-${safeName(input.filename || "generated.jsonl")}`);
  fs.writeFileSync(filePath, bytes, { mode: 0o600 });
  const record: GatewayFileRecord = {
    id,
    object: "file",
    bytes: bytes.length,
    created_at: Math.floor(Date.now() / 1000),
    filename: input.filename || "generated.jsonl",
    purpose: input.purpose,
    path: filePath,
  };
  writeJson("files.json", [...listGatewayFiles().filter((item) => item.id !== id), record]);
  return record;
}

export function deleteGatewayFile(id: string): boolean {
  const files = listGatewayFiles();
  const found = files.find((file) => file.id === id);
  if (!found) return false;
  try {
    if (found.path && fs.existsSync(found.path)) fs.unlinkSync(found.path);
  } catch (err) { logger.warn("[auto-fix] Empty catch block", err); }
  writeJson("files.json", files.filter((file) => file.id !== id));
  return true;
}

export function readGatewayFileContent(id: string): Buffer | null {
  const file = getGatewayFile(id);
  if (!file || !file.path || !fs.existsSync(file.path)) return null;
  return fs.readFileSync(file.path);
}

export function listGatewayBatches(): GatewayBatchRecord[] {
  return readJson<GatewayBatchRecord[]>("batches.json", []);
}

export function getGatewayBatch(id: string): GatewayBatchRecord | null {
  return listGatewayBatches().find((batch) => batch.id === id) || null;
}

export function createGatewayBatch(input: Partial<GatewayBatchRecord>): GatewayBatchRecord {
  const id = `batch_${crypto.randomBytes(12).toString("hex")}`;
  const record: GatewayBatchRecord = {
    id,
    object: "batch",
    endpoint: String(input.endpoint || "/v1/chat/completions"),
    input_file_id: String(input.input_file_id || ""),
    completion_window: String(input.completion_window || "24h"),
    status: "validating",
    created_at: Math.floor(Date.now() / 1000),
    completed_at: null,
    error_file_id: null,
    output_file_id: null,
    request_counts: { total: 0, completed: 0, failed: 0 },
    metadata: (input.metadata && typeof input.metadata === "object" ? input.metadata : {}) as JsonRecord,
  };
  if (!record.input_file_id) {
    record.status = "failed";
    record.metadata = { ...record.metadata, error: "input_file_id is required" };
  } else if (!getGatewayFile(record.input_file_id)) {
    record.status = "failed";
    record.metadata = { ...record.metadata, error: "input_file_id was not found" };
  } else {
    record.status = "in_progress";
    record.metadata = {
      ...record.metadata,
      execution: "zavorth-native-worker-pending",
      note: "Zavorth native batch accepted. The local worker will produce output/error files.",
    };
  }
  writeJson("batches.json", [record, ...listGatewayBatches().filter((batch) => batch.id !== id)]);
  return record;
}

export function updateGatewayBatch(id: string, patch: Partial<GatewayBatchRecord>): GatewayBatchRecord | null {
  const batches = listGatewayBatches();
  const existing = batches.find((batch) => batch.id === id);
  if (!existing) return null;
  const updated: GatewayBatchRecord = {
    ...existing,
    ...patch,
    id: existing.id,
    object: "batch",
    metadata: {
      ...existing.metadata,
      ...(patch.metadata && typeof patch.metadata === "object" ? patch.metadata : {}),
    },
    request_counts: patch.request_counts || existing.request_counts || { total: 0, completed: 0, failed: 0 },
  };
  writeJson("batches.json", batches.map((batch) => (batch.id === id ? updated : batch)));
  return updated;
}

export function cancelGatewayBatch(id: string): GatewayBatchRecord | null {
  const batches = listGatewayBatches();
  const existing = batches.find((batch) => batch.id === id);
  if (!existing) return null;
  const updated: GatewayBatchRecord = {
    ...existing,
    status: existing.status === "completed" ? "completed" : "cancelled",
    completed_at: existing.completed_at || Math.floor(Date.now() / 1000),
  };
  writeJson("batches.json", batches.map((batch) => (batch.id === id ? updated : batch)));
  return updated;
}

export function deleteCompletedGatewayBatches(): number {
  const batches = listGatewayBatches();
  const kept = batches.filter((batch) => !["completed", "failed", "cancelled"].includes(batch.status));
  writeJson("batches.json", kept);
  return batches.length - kept.length;
}

export function buildGatewayHealthSnapshot() {
  return {
    object: "zavorth.gateway.runtime",
    created_at: Math.floor(Date.now() / 1000),
    host: os.hostname(),
    files: listGatewayFiles().length,
    batches: listGatewayBatches().length,
    store: STORE_DIR,
  };
}
