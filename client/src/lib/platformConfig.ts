export async function loadPublicPlatformConfig(): Promise<void> {
  try {
    const response = await fetch("/api/platform/config.js", {
      credentials: "same-origin",
    });
    if (!response.ok) return;
    const script = await response.text();
    const match = script.match(/^window\.__MANUS_CONFIG__=(.*);$/s);
    if (!match) return;
    const config = JSON.parse(match[1]) as Window["__MANUS_CONFIG__"];
    if (config) window.__MANUS_CONFIG__ = config;
  } catch {
    // The application remains usable in local/static mode without platform config.
  }
}
