import { atom } from 'nanostores';
import type { ApprovalItem, HostCommandItem, TaskMandate, WorkspaceWriteApprovalItem } from '../apiClient';

export const $approvals = atom<ApprovalItem[]>([]);
export const $workspaceWriteApprovals = atom<WorkspaceWriteApprovalItem[]>([]);
export const $proposedMandate = atom<TaskMandate | null>(null);
export const $activeMandate = atom<TaskMandate | null>(null);
export const $pendingHostCommands = atom<HostCommandItem[]>([]);
export const $showTrustPrompt = atom(false);
export const $trustLoading = atom(false);

export function setApprovals(a: ApprovalItem[]) { $approvals.set(a); }
export function setWorkspaceWriteApprovals(w: WorkspaceWriteApprovalItem[]) { $workspaceWriteApprovals.set(w); }
export function setProposedMandate(m: TaskMandate | null) { $proposedMandate.set(m); }
export function setActiveMandate(m: TaskMandate | null) { $activeMandate.set(m); }
export function setPendingHostCommands(c: HostCommandItem[]) { $pendingHostCommands.set(c); }
export function setShowTrustPrompt(s: boolean) { $showTrustPrompt.set(s); }
export function setTrustLoading(l: boolean) { $trustLoading.set(l); }
