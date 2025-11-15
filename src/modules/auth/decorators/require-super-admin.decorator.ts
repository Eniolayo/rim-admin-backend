import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SUPER_ADMIN_KEY = 'requireSuperAdmin';

export const RequireSuperAdmin = (): ReturnType<typeof SetMetadata> => {
  return SetMetadata(REQUIRE_SUPER_ADMIN_KEY, true);
};

