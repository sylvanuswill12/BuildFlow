export const BUILD_FLOW_ADMIN_EMAIL = "atchouyaosylvain59@gmail.com";

export function isBuildFlowAdminEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === BUILD_FLOW_ADMIN_EMAIL;
}
