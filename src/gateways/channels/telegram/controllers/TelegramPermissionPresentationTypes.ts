import type {
  PermissionCommandMatchType,
  PermissionRequest,
  PermissionScope,
  PermissionStatus,
} from '../../../../contracts/PermissionRequest.js';

export type TelegramPermissionPresentationPolicy = {
  shortPermissionId(permission: PermissionRequest): string;
  describePermissionStatus(status: PermissionStatus | 'all'): string;
  describePermissionSubject(permission: PermissionRequest): string;
  describePermissionScope(scope: PermissionScope): string;
  getExternalExecutorAgentRole(permission: PermissionRequest): string;
  describePermissionAccessLevel(permission: PermissionRequest): string;
  describePermissionCommandMatchType(permission: PermissionRequest): string;
  describeAiStudioPermissionValues(permission: PermissionRequest): string;
  getPermissionAccessLevel(permission: PermissionRequest): string;
  getPermissionCommandMatchType(permission: PermissionRequest): PermissionCommandMatchType;
};
