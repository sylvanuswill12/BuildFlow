const TLS_ENABLED_MODES = new Set([
  "PREFERRED",
  "REQUIRED",
  "VERIFY_CA",
  "VERIFY_IDENTITY",
]);

/**
 * mysql2 does not understand Aiven's `ssl-mode` URI parameter. Translate it to
 * mysql2's JSON `ssl` URI option while preserving Aiven/MySQL semantics:
 * REQUIRED encrypts without validating the server certificate; VERIFY modes
 * require the Aiven CA and enable certificate validation.
 * The database URL remains server-side and is never logged by this helper.
 */
export function normalizeMySql2ConnectionUrl(databaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid MySQL connection URL.");
  }

  const sslModeEntries = [...url.searchParams.entries()].filter(
    ([key]) => key.toLowerCase() === "ssl-mode"
  );
  if (sslModeEntries.length === 0) return databaseUrl;
  if (url.protocol !== "mysql:") {
    throw new Error(
      "DATABASE_URL must use the mysql:// scheme when ssl-mode is specified."
    );
  }
  if (sslModeEntries.length !== 1) {
    throw new Error(
      "DATABASE_URL must contain exactly one ssl-mode parameter."
    );
  }

  const [modeKey, rawMode] = sslModeEntries[0];
  const mode = rawMode.trim().toUpperCase();
  if (mode === "DISABLED") {
    throw new Error(
      "Aiven MySQL requires TLS; ssl-mode=DISABLED is not supported."
    );
  }
  if (!TLS_ENABLED_MODES.has(mode)) {
    throw new Error(`Unsupported MySQL ssl-mode: ${mode || "(empty)"}.`);
  }

  const sslEntries = [...url.searchParams.entries()].filter(
    ([key]) => key.toLowerCase() === "ssl"
  );
  if (sslEntries.length > 1) {
    throw new Error("DATABASE_URL must contain at most one ssl parameter.");
  }

  let sslOptions: Record<string, unknown>;
  if (sslEntries.length === 1) {
    try {
      const parsed: unknown = JSON.parse(sslEntries[0][1]);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error("invalid SSL object");
      }
      sslOptions = parsed as Record<string, unknown>;
    } catch {
      throw new Error("DATABASE_URL contains an invalid mysql2 ssl option.");
    }
  } else {
    sslOptions = {};
  }

  const verifiesCertificate =
    mode === "VERIFY_CA" || mode === "VERIFY_IDENTITY";
  if (verifiesCertificate) {
    if (sslOptions.rejectUnauthorized === false) {
      throw new Error(
        "Certificate verification cannot be disabled for MySQL VERIFY modes."
      );
    }
    if (!sslOptions.ca) {
      throw new Error(
        `DATABASE_URL uses ssl-mode=${mode}; configure the Aiven CA certificate in mysql2's ssl option.`
      );
    }
    sslOptions.rejectUnauthorized = true;
    if (mode === "VERIFY_IDENTITY") sslOptions.verifyIdentity = true;
  } else if (sslOptions.rejectUnauthorized === undefined && !sslOptions.ca) {
    // Aiven's REQUIRED/PREFERRED modes encrypt the connection but, by design,
    // do not authenticate the server certificate. Aiven itself requires TLS.
    sslOptions.rejectUnauthorized = false;
  }

  url.searchParams.delete(modeKey);

  if (sslEntries.length === 1) {
    const [sslKey] = sslEntries[0];
    url.searchParams.delete(sslKey);
  }
  url.searchParams.set("ssl", JSON.stringify(sslOptions));
  return url.toString();
}
