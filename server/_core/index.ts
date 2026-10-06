import "dotenv/config";
import express from "express";
import type { Server } from "http";
import { randomUUID } from "node:crypto";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { z } from "zod";
import { appRouter } from "../routers";
import { AI_PROVIDER_IDS, defaultConfiguredAiProvider, listAiProviders } from "../aiProviders";
import { streamRoutedLLM, type AiInvocationMetadata } from "../ai/routing";
import { usageRecordFields } from "../ai/usage";
import { parseGeneratedChange } from "../generation";
import { buildActionStreamMessages } from "../ai/generationContract";
import { AgentActionStreamParser, buildActionGenerationResult } from "../ai/actionStream";
import * as db from "../db";
import { authenticateRequest } from "../auth";
import { readImageAttachment } from "../storage";
import { attachImagesToLastUserMessage } from "../ai/attachments";
import { handleStripeWebhook } from "../stripe";
import { createContext } from "./context";

const repairSessions = new Map<string, { userId: number; projectId: string; attempts: number; expiresAt: number }>();

export async function createApp(_options: { server?: Server } = {}) {
  const app = express();
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
  app.use(express.json({ limit: "150mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", async (req, res) => {
    const deep = req.query.deep === "1";
    const configuredAi = listAiProviders()
      .filter(provider => provider.configured)
      .map(provider => provider.id);
    const checks = {
      api: true,
      database: deep ? await db.checkDatabase() : Boolean(process.env.DATABASE_URL),
      auth: Boolean(process.env.APP_SESSION_SECRET && process.env.APP_SESSION_SECRET.length >= 32),
      ai: configuredAi.length > 0,
    };
    res.json({
      status: "ok",
      ready: Object.values(checks).every(Boolean),
      checks,
      configuredAi,
      deep,
    });
  });
  app.get("/api/attachments/:id", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) { res.status(401).end(); return; }
      const id = String(req.params.id ?? "");
      if (!/^[0-9a-f-]{36}$/i.test(id)) { res.status(404).end(); return; }
      const attachment = await db.getProjectAttachment(user.id, id);
      if (!attachment) { res.status(404).end(); return; }
      const bytes = attachment.fileData ?? await readImageAttachment(attachment.storageKey);
      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("Content-Length", String(bytes.byteLength));
      res.setHeader("Content-Disposition", "inline");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(bytes);
    } catch {
      res.status(404).end();
    }
  });
  app.post("/api/generation/change-stream", async (req, res) => {
    let user;
    try {
      user = await authenticateRequest(req);
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
        projectId: z.string().min(4).max(64),
        repairSessionId: z.string().uuid().optional(),
        attachments: z.array(z.string().uuid()).max(4).optional(),
        activeFile: z.string().trim().min(1).max(120).optional(),
        mode: z.enum(["plan", "discussion", "build"]).default("build"),
        prompt: z.string().trim().min(2).max(2_000),
        currentCode: z.string().max(40_000),
        currentFiles: z.record(z.string().max(120), z.string().max(40_000)).optional(),
        revision: z.number().int().min(0).max(10_000),
        provider: z.enum(AI_PROVIDER_IDS).default(defaultConfiguredAiProvider()),
        model: z.string().trim().min(1).max(160).optional(),
        smartModelRouting: z.boolean().default(false),
        providerFallback: z.boolean().default(true),
        importGraphIndex: z.boolean().default(true),
        trackUsage: z.boolean().default(true),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Paramètres de génération invalides" });
      return;
    }
    const input = parsed.data;
    let repairSession: { userId: number; projectId: string; attempts: number; expiresAt: number } | undefined;
    if (input.repairSessionId) {
      repairSession = repairSessions.get(input.repairSessionId);
      if (!repairSession || repairSession.expiresAt < Date.now() || repairSession.userId !== user.id || repairSession.projectId !== input.projectId || repairSession.attempts >= 3) {
        res.status(403).json({ error: "Session d’auto-réparation invalide ou expirée." });
        return;
      }
      repairSession.attempts += 1;
    }
    let priorMessages: Awaited<ReturnType<typeof db.listProjectMessages>>;
    let attachedImages: Array<{ mimeType: string; bytes: Uint8Array }> = [];
    try {
      const project = await db.getProject(user.id, input.projectId);
      if (!project) {
        res.status(404).json({ error: "Projet introuvable." });
        return;
      }
      const attachmentIds = [...new Set(input.attachments ?? [])];
      if (attachmentIds.length) {
        const records = await db.listProjectAttachments(user.id, input.projectId, attachmentIds);
        if (records.length !== attachmentIds.length) {
          res.status(404).json({ error: "Une ou plusieurs images jointes sont introuvables." });
          return;
        }
        const byId = new Map(records.map(record => [record.id, record]));
        attachedImages = await Promise.all(attachmentIds.map(async id => {
          const record = byId.get(id)!;
          const bytes = record.fileData ?? await readImageAttachment(record.storageKey);
          return { mimeType: record.mimeType, bytes: new Uint8Array(bytes) };
        }));
      }
      const storedMessages = await db.listProjectMessages(user.id, input.projectId);
      const lastStored = storedMessages.at(-1);
      priorMessages = lastStored?.role === "user" && lastStored.content === input.prompt
        ? storedMessages.slice(0, -1)
        : storedMessages;
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Impossible de charger la conversation." });
      return;
    }
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
      const actionParser = new AgentActionStreamParser();
      const invocationParams = {
        model: input.model,
        messages: attachImagesToLastUserMessage(buildActionStreamMessages({
          prompt: input.prompt,
          currentCode: input.currentCode,
          currentFiles: input.currentFiles ?? { "src/App.tsx": input.currentCode },
          revision: input.revision,
          activeFile: input.activeFile,
          mode: input.mode,
          importGraphIndex: input.importGraphIndex,
          conversation: priorMessages
            .filter(message => message.role === "user" || message.role === "assistant")
            .map(message => ({ role: message.role as "user" | "assistant", content: message.content, actions: message.actions })),
        }), attachedImages),
        maxTokens: 12_000,
      };
      const routingOptions = {
        smartModelRouting: input.smartModelRouting,
        providerFallback: input.providerFallback,
        prompt: input.prompt,
        currentFiles: input.currentFiles ?? { "src/App.tsx": input.currentCode },
      };
      let invocationMetadata: AiInvocationMetadata | undefined;
      for await (const chunk of streamRoutedLLM(input.provider, invocationParams, routingOptions, metadata => { invocationMetadata = metadata; })) {
        rawParts.push(chunk);
        const actions = actionParser.push(chunk);
        for (const action of actions) sendEvent("action", action);
        if (actionParser.protocolMode === "json") sendEvent("chunk", { text: chunk });
      }
      const generated = actionParser.actions.length
        ? {
            ...buildActionGenerationResult(
              actionParser.actions,
              input.currentFiles ?? { "src/App.tsx": input.currentCode },
              input.currentCode
            ),
            agentActions: actionParser.actions,
          }
        : parseGeneratedChange(rawParts.join(""));
      if (!generated) throw new Error("La réponse IA est incomplète.");
      const usage = input.repairSessionId
        ? { credits: user.credits, generationCount: user.generationCount }
        : user.role === "admin"
          ? { credits: user.credits, generationCount: user.generationCount }
          : await db.consumeCredit(user.id);
      if (!usage) throw new Error("Vous n’avez plus de crédits IA disponibles.");
      if (input.trackUsage && invocationMetadata) {
        const fields = usageRecordFields(invocationMetadata, invocationParams, rawParts.join(""));
        await db.createAiUsage({
          id: randomUUID(), ownerId: user.id, projectId: input.projectId,
          ...fields, tokenCountsEstimated: fields.tokenCountsEstimated ? 1 : 0,
        }).catch(error => console.warn("[AI usage] Stream usage could not be saved:", error));
      }
      const repairSessionId = input.repairSessionId ?? randomUUID();
      if (!input.repairSessionId) {
        const now = Date.now();
        for (const [id, session] of repairSessions) if (session.expiresAt < now) repairSessions.delete(id);
        repairSessions.set(repairSessionId, { userId: user.id, projectId: input.projectId, attempts: 0, expiresAt: now + 10 * 60_000 });
      }
      sendEvent("complete", {
        ...generated,
        previewRevision: input.revision + 1,
        repairSessionId,
        ...usage,
      });
      if (repairSession?.attempts === 3 && input.repairSessionId) repairSessions.delete(input.repairSessionId);
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
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  return app;
}
