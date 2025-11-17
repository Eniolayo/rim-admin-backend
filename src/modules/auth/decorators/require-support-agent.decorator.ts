import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SUPPORT_AGENT_KEY = 'requireSupportAgent';

export const RequireSupportAgent = (): ReturnType<typeof SetMetadata> => {
  return SetMetadata(REQUIRE_SUPPORT_AGENT_KEY, true);
};

