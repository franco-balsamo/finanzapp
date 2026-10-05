import type { AuthError } from '@supabase/supabase-js';

/** Los errores de Supabase Auth, en voseo. */
export function authErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'otp_expired':
      return 'El código no es válido o ya venció.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Esperá un minuto antes de pedir otro código.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Revisá el mail.';
    default:
      return error.status === 0 || error.name === 'AuthRetryableFetchError'
        ? 'Sin conexión. Probá de nuevo.'
        : 'Algo falló. Probá de nuevo.';
  }
}
