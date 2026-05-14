export interface ApprovalRequest {
  approval_id: string;
  task_id: string;
  created_at: string;
  risk_level: number;
  reason: string;
  sensitive_actions: string[];
  expires_at: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
}
