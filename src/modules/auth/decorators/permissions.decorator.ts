import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

export type PermissionAction = 'read' | 'write' | 'delete';

export interface PermissionMetadata {
  resource: string;
  actions: PermissionAction[];
}

export const Permissions = (
  resource: string,
  ...actions: PermissionAction[]
): ReturnType<typeof SetMetadata> => {
  return SetMetadata(PERMISSIONS_KEY, {
    resource,
    actions: actions.length > 0 ? actions : ['read', 'write', 'delete'],
  } as PermissionMetadata);
};

