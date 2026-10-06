import { ENV } from "./_core/env";

export function isBuildFlowAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ENV.adminEmails.includes(email.trim().toLowerCase());
}
