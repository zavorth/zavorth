export type ResponseType = 
  | 'status'
  | 'plan'
  | 'result'
  | 'approval'
  | 'error'
  | 'help'
  | 'logs'
  | 'diff';

export interface TelegramResponse {
  response_id: string;
  task_id: string | null;
  chat_id: string;
  response_type: ResponseType;
  title: string;
  message: string;
  short_summary: string | null;
  attachments: any[];
  requires_user_action: boolean;
  suggested_commands: string[];
}
