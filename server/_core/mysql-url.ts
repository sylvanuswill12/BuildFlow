const TLS_ENABLED_MODES = new Set([
  "PREFERRED",
  "REQUIRED",
  "VERIFY_CA",
  "VERIFY_IDENTITY",
]);

/**
 * mysql2 does not understand Aiven's `ssl-mode` URI parameter. Translate it to
 * mysql2's JSON `ssl` URI option, keeping certificate verification enabled.
 * The database URL remains server-side and is never logged by this helper.
 */
export function normalizeMySql2ConnectionUrl(databaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid MySQL connection URL.");
  }

  const sslModeEntries = [...url.searchParams.entries()].filter(([key]) =>
    key.toLowerCase() === "ssl-mode"
  );
  if (sslModeEntries.length === 0) return databaseUrl;
  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must use the mysql:// scheme when ssl-mode is specified.");
  }
  if (sslModeEntries.length !== 1) {
    throw new Error("DATABASE_URL must contain exactly one ssl-mode parameter.");
  }

  const [modeKey, rawMode] = sslModeEntries[0];
  const mode = rawMode.trim().toUpperCase();
  if (mode === "DISABLED") {
    throw new Error("Aiven MySQL requires TLS; ssl-mode=DISABLED is not supported.");
  }
  if (!TLS_ENABLED_MODES.has(mode)) {
    throw new Error(`Unsupported MySQL ssl-mode: ${mode || "(empty)"}.`);
  }

  const sslEntries = [...url.searchParams.entries()].filter(([key]) =>
    key.toLowerCase() === "ssl"
  );
  if (sslEntries.length > 1) {
    throw new Error("DATABASE_URL must contain at most one ssl parameter.");
  }

  let sslOptions: unknown;
  if (sslEntries.length === 1) {
    try {
      sslOptions = JSON.parse(sslEntries[0][1]);
    } catch {
      throw new Error("DATABASE_URL contains an invalid mysql2 ssl option.");
    }

    if (
      sslOptions === false ||
      (typeof sslOptions === "object" &&
        sslOptions !== null &&
        "rejectUnauthorized" in sslOptions &&
        (sslOptions as { rejectUnauthorized?: unknown }).rejectUnauthorized === false)
    ) {
      throw new Error("DATABASE_URL ssl options must not disable certificate verification.");
    }
  }

  if (mode === "VERIFY_CA" || mode === "VERIFY_IDENTITY") {
    if (
      typeof sslOptions !== "object" ||
      sslOptions === null ||
      !("ca" in sslOptions) ||
      !(sslOptions as { ca?: unknown }).ca
    ) {
      throw new Error(
        `DATABASE_URL uses ssl-mode=${mode}; configure the Aiven CA certificate in mysql2's ssl option.`
      );
    }
  }

  url.searchParams.delete(modeKey);

  if (sslEntries.length === 1) {
    const [sslKey, rawSsl] = sslEntries[0];
    if (sslKey !== "ssl") {
      url.searchParams.delete(sslKey);
      url.searchParams.set("ssl", rawSsl);
    }
    return url.toString();
  }

  url.searchParams.set("ssl", JSON.stringify({ rejectUnauthorized: true }));
  return url.toString();
}
