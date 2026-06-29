import { atom } from 'nanostores';
import type { ApprovalItem } from '../apiClient';

export const $approvals = atom<ApprovalItem[]>([]);
export const $workspaceWriteApprovals = atom<any[]>([]);
export const $proposedMandate = atom<any>(null);
export const $activeMandate = atom<any>(null);
export const $pendingHostCommands = atom<any[]>([]);
export const $showTrustPrompt = atom(false);
export const $trustLoading = atom(false);

export function setApprovals(a: ApprovalItem[]) { $approvals.set(a); }
export function setWorkspaceWriteApprovals(w: any[]) { $workspaceWriteApprovals.set(w); }
export function setProposedMandate(m: any) { $proposedMandate.set(m); }
export function setActiveMandate(m: any) { $activeMandate.set(m); }
export function setPendingHostCommands(c: any[]) { $pendingHostCommands.set(c); }
export function setShowTrustPrompt(s: boolean) { $showTrustPrompt.set(s); }
export function setTrustLoading(l: boolean) { $trustLoading.set(l); }
