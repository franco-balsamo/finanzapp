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
      // status 0: el fetch ni llegó al servidor; un 5xx también es AuthRetryableFetchError, pero hubo conexión.
      return error.status === 0 ? 'Sin conexión. Probá de nuevo.' : 'Algo falló. Probá de nuevo.';
  }
}
