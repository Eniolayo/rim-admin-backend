import { SetMetadata } from '@nestjs/common';

export const WEBHOOK_KIND_KEY = 'webhookKind';
export const WebhookKind = (kind: 'loan' | 'recovery') =>
  SetMetadata(WEBHOOK_KIND_KEY, kind);
