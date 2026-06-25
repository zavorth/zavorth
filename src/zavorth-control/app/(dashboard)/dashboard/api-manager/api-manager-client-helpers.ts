"use client";

import { useEffect, useState } from "react";

export const MAX_KEY_NAME_LENGTH = 100;
export const MAX_SELECTED_MODELS = 500;

type TranslateFn = (key: string, values?: Record<string, unknown>) => string;

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/"/g, "")
    .replace(/'/g, "")
    .trim()
    .slice(0, MAX_KEY_NAME_LENGTH);
}

export function validateKeyName(
  name: string,
  t: TranslateFn
): { valid: boolean; error?: string } {
  if (!name || !name.trim()) {
    return { valid: false, error: t("keyNameRequired") };
  }
  if (name.length > MAX_KEY_NAME_LENGTH) {
    return { valid: false, error: t("keyNameTooLong", { max: MAX_KEY_NAME_LENGTH }) };
  }
  if (!/^[a-zA-Z0-9_\-\s]+$/.test(name)) {
    return {
      valid: false,
      error: t("keyNameInvalid"),
    };
  }
  return { valid: true };
}

export interface AccessSchedule {
  enabled: boolean;
  from: string;
  until: string;
  days: number[];
  tz: string;
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  allowedModels: string[] | null;
  allowedConnections: string[] | null;
  noLog?: boolean;
  autoResolve?: boolean;
  isActive?: boolean;
  maxSessions?: number;
  accessSchedule?: AccessSchedule | null;
  createdAt: string;
}

export interface ProviderConnection {
  id: string;
  name: string;
  provider: string;
  isActive: boolean;
}

export interface KeyUsageStats {
  totalRequests: number;
  lastUsed: string | null;
}

export interface Model {
  id: string;
  owned_by: string;
}

export type ProviderGroup = [provider: string, models: Model[]];
