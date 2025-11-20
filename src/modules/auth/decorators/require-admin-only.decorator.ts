import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ADMIN_ONLY_KEY = 'requireAdminOnly';

export const RequireAdminOnly = (): ReturnType<typeof SetMetadata> => {
  return SetMetadata(REQUIRE_ADMIN_ONLY_KEY, true);
};

