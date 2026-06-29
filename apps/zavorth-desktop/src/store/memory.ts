import { atom } from 'nanostores';
import type { LearningItem, MemoryItem, ToolItem, ControlMemorySnapshot, MemoryEncryptionStatus, MemoryEncryptionMigrationReceipt } from '../apiClient';

export const $learning = atom<LearningItem[]>([]);
export const $tools = atom<ToolItem[]>([]);
export const $controlMemory = atom<ControlMemorySnapshot | null>(null);
export const $memoryEncryptionStatus = atom<MemoryEncryptionStatus | null>(null);
export const $memoryEncryptionReceipt = atom<MemoryEncryptionMigrationReceipt | null>(null);

export function setLearning(l: LearningItem[]) { $learning.set(l); }
export function setTools(t: ToolItem[]) { $tools.set(t); }
export function setControlMemory(c: ControlMemorySnapshot | null) { $controlMemory.set(c); }
export function setMemoryEncryptionStatus(s: MemoryEncryptionStatus | null) { $memoryEncryptionStatus.set(s); }
export function setMemoryEncryptionReceipt(r: MemoryEncryptionMigrationReceipt | null) { $memoryEncryptionReceipt.set(r); }
