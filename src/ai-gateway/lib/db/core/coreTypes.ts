export type SqliteDatabase = import("better-sqlite3").Database;
export type JsonRecord = Record<string, unknown>;
export type CheckpointMode = "PASSIVE" | "FULL" | "RESTART" | "TRUNCATE";
export type SqliteColumnInfo = { name?: string };
