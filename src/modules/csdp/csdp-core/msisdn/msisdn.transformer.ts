import { ValueTransformer } from 'typeorm';
import { toE164Nigerian } from '../../../../common/utils/phone.utils';

export const msisdnTransformer: ValueTransformer = {
  to: (value?: string | null) => (value == null ? value : (toE164Nigerian(value) ?? value)),
  from: (value?: string | null) => value ?? null,
};
