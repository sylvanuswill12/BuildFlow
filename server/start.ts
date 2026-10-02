import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "./_core/index";
import { serveStatic, setupVite } from "./_core/vite";

const server = createServer();
const app = await createApp({ server });
if (process.env.NODE_ENV === "development") {
  await setupVite(app, server);
} else {
  serveStatic(app);
}
server.on("request", app);

const port = Number(process.env.PORT || "3000");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("Invalid PORT");
}
server.on("error", error => {
  console.error("Server failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
server.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});
