// A UI hint only: database and Storage policies remain the authority.
// Keep in sync with offpat_private.is_editor(); avoid publishing the email itself.
const EDITOR_EMAIL_HASH = '600a60b65ae92b3a0cfae1b487fa1cc4e44f14a1332df32cb33b10f837f7cc75';
export async function isEditorEmail(email: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('') === EDITOR_EMAIL_HASH;
}
export function loginError(error: unknown): string | undefined {
  const value = error as { code?: string; status?: number };
  if (value?.code === 'over_email_send_rate_limit') return 'Too many sign-in emails have been requested. Please wait before requesting another; the email limit can take up to an hour to clear. You can still enter an unused code you already received.';
  if (value?.status === 429 || value?.code === 'over_request_rate_limit') return 'Too many sign-in attempts. Please wait before trying again.';
  if (value?.code === 'otp_expired') return 'That code is incorrect, expired or already used. Check the latest email before requesting another code.';
}
