import "dotenv/config";
import express from "express";
import { createServer, type Server } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { z } from "zod";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { streamConfiguredLLM, AI_PROVIDER_IDS } from "../aiProviders";
import { parseGeneratedChange } from "../generation";
import * as db from "../db";
import { sdk } from "./sdk";
import { handleStripeWebhook } from "../stripe";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

export async function createApp(options: { serveClient?: boolean; server?: Server } = {}) {
  const app = express();
  const shouldServeClient = options.serveClient ?? true;
  app.use((_req, res, next) => {
    // WebContainer requires a cross-origin isolated browsing context. The
    // credentialless mode remains compatible with the Cloud Preview iframe.
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
    next();
  });
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      await handleStripeWebhook(req.body as Buffer, req.header("stripe-signature"));
      res.json({ received: true });
    } catch (error) {
      console.error("[Stripe] Webhook rejected:", error instanceof Error ? error.message : error);
      res.status(400).json({ error: "Webhook Stripe invalide" });
    }
  });
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.post("/api/generation/change-stream", async (req, res) => {
    let user;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }
    if (!user) {
      res.status(401).json({ error: "Authentification requise" });
      return;
    }
    const parsed = z
      .object({
        prompt: z.string().trim().min(2).max(2_000),
        currentCode: z.string().max(40_000),
        currentFiles: z.record(z.string().max(120), z.string().max(40_000)).optional(),
        revision: z.number().int().min(0).max(10_000),
        provider: z.enum(AI_PROVIDER_IDS).default("manus"),
        model: z.string().trim().min(1).max(160).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Paramètres de génération invalides" });
      return;
    }
    const input = parsed.data;
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      sendEvent("status", { label: "Connexion au provider IA…" });
      const rawParts: string[] = [];
      for await (const chunk of streamConfiguredLLM(input.provider, {
        model: input.model,
        messages: [
          {
            role: "system",
            content:
              "Tu es BuildFlow Agent, un ingénieur full-stack senior. Retourne uniquement le JSON demandé, sans markdown. Le champ code doit contenir le fichier page.tsx final. Le champ files contient les fichiers relatifs créés ou remplacés, compatibles React + Vite.",
          },
          {
            role: "user",
            content: `Demande utilisateur :\n${input.prompt}\n\nRévision actuelle : ${input.revision}\n\nFichier actif page.tsx :\n${input.currentCode}\n\nFichiers du projet :\n${JSON.stringify(input.currentFiles ?? { "page.tsx": input.currentCode }, null, 2)}`,
          },
        ],
        maxTokens: 12_000,
        outputSchema: {
          name: "buildflow_generation",
          strict: true,
          schema: {
            type: "object",
            properties: {
              code: { type: "string" },
              changes: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
              assistantMessage: { type: "string" },
              files: {
                type: "array",
                items: {
                  type: "object",
                  properties: { path: { type: "string" }, content: { type: "string" } },
                  required: ["path", "content"],
                  additionalProperties: false,
                },
                maxItems: 12,
              },
            },
            required: ["code", "changes", "assistantMessage", "files"],
            additionalProperties: false,
          },
        },
      })) {
        rawParts.push(chunk);
        sendEvent("chunk", { text: chunk });
      }
      const generated = parseGeneratedChange(rawParts.join(""));
      if (!generated) throw new Error("La réponse IA est incomplète.");
      const usage =
        user.role === "admin"
          ? { credits: user.credits, generationCount: user.generationCount }
          : await db.consumeCredit(user.id);
      if (!usage) throw new Error("Vous n’avez plus de crédits IA disponibles.");
      sendEvent("complete", {
        ...generated,
        previewRevision: input.revision + 1,
        ...usage,
      });
      res.end();
    } catch (error) {
      sendEvent("error", {
        message: error instanceof Error ? error.message : "La génération a échoué.",
      });
      res.end();
    }
  });
  app.get("/api/generation/stream", (_req, res) => {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const stages = [
      "Analyse de votre idée…",
      "Préparation de l’architecture…",
      "Génération des fichiers…",
      "Sauvegarde du workspace…",
      "Ouverture de la preview…",
    ];
    let index = 0;
    const send = () => {
      res.write(`data: ${JSON.stringify({ index, label: stages[index] })}\n\n`);
      index += 1;
      if (index >= stages.length) {
        clearInterval(timer);
        res.end();
      }
    };
    const timer = setInterval(send, 900);
    send();
    res.on("close", () => clearInterval(timer));
  });
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Netlify serves the Vite output from its CDN; the standalone server serves it locally.
  if (shouldServeClient) {
    if (process.env.NODE_ENV === "development") {
      await setupVite(app, options.server ?? createServer(app));
    } else {
      serveStatic(app);
    }
  }
  return app;
}

async function startServer() {
  const server = createServer();
  const app = await createApp({ server });
  server.on("request", app);
  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}

if (process.env.NETLIFY !== "true") {
  startServer().catch(error => { console.error(error); process.exit(1); });
}
