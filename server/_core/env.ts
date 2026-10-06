const value = (name: string) => process.env[name]?.trim() ?? "";

export const ENV = {
  get databaseUrl() {
    return value("DATABASE_URL");
  },
  get sessionSecret() {
    return value("APP_SESSION_SECRET");
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get adminEmails() {
    return value("ADMIN_EMAILS")
      .split(",")
      .map(email => email.trim().toLowerCase())
      .filter(Boolean);
  },
};
