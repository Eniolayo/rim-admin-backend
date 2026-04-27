import { SetMetadata } from '@nestjs/common';

export const CsdpScopes = (...scopes: string[]) =>
  SetMetadata('csdpScopes', scopes);
