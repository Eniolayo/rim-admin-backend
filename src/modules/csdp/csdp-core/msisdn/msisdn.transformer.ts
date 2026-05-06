import { ValueTransformer } from 'typeorm';
import { normalizeMsisdn } from '../../../../common/utils/phone.utils';

/**
 * Persists MSISDN columns in canonical 234XXXXXXXXXX form.
 *
 * - Writes (`to`): `normalizeMsisdn` — throws on invalid input. Pairs with
 *   the per-column DB CHECK regex so callers can never persist a bad MSISDN.
 * - Reads (`from`): pass-through (DB values already satisfy the CHECK).
 */
export const msisdnTransformer: ValueTransformer = {
  to: (value?: string | null) => (value == null ? value : normalizeMsisdn(value)),
  from: (value?: string | null) => value ?? null,
};
