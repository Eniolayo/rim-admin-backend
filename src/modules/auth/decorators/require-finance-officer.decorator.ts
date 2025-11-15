import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FINANCE_OFFICER_KEY = 'requireFinanceOfficer';

export const RequireFinanceOfficer = (): ReturnType<typeof SetMetadata> => {
  return SetMetadata(REQUIRE_FINANCE_OFFICER_KEY, true);
};

