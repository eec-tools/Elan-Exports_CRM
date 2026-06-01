const MAIL_SERVER_PREFIXES = /^(smtp|imap|pop3?|mail|webmail)\./i;

/**
 * Strips mail-server subdomain prefixes (smtp., imap., pop., pop3., mail., webmail.)
 * from the domain part of an email address.
 * e.g. cristian@smtp.andesalimentos.com → cristian@andesalimentos.com
 */
export function sanitizeEmail(email: string | null | undefined): string | null {
  if (!email) return email ?? null;
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at === -1) return trimmed;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const cleanDomain = domain.replace(MAIL_SERVER_PREFIXES, "");
  return `${local}@${cleanDomain}`;
}
