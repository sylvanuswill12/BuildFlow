import { COOKIE_NAME, SESSION_MAX_AGE_MS } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { createSessionToken, hashPassword, toPublicUser, verifyPassword } from "./auth";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { BILLING_PLANS } from "./billing";
import { parseGeneratedChange } from "./generation";
import { parseSnapshotFiles, serializeSnapshotFiles } from "./snapshots";
import { IMAGE_MIME_TYPES, MAX_IMAGE_BASE64_CHARS, MAX_IMAGE_BYTES, createImageStorageKey } from "./storage";
import { buildGenerationMessages, GENERATION_OUTPUT_SCHEMA } from "./ai/generationContract";
import { runAdvancedResearch } from "./research";
import {
  AI_PROVIDER_IDS,
  defaultConfiguredAiProvider,
  listAiModels,
  listAiProviders,
  testAiProvider,
} from "./aiProviders";
import { invokeRoutedLLM, type RoutingOptions } from "./ai/routing";
import { usageRecordFields } from "./ai/usage";
import {
  deployFiles,
  deploymentPreflight,
  type DeploymentFiles,
  type DeploymentTarget,
} from "./deployments";
import { getStarterTemplateFiles, STARTER_TEMPLATE_IDS } from "../shared/starterTemplates";

const getStripe = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Stripe n’est pas encore configuré.",
    });
  return new Stripe(secretKey);
};

const generationInput = z.object({
  prompt: z.string().trim().min(12).max(4_000),
  currentCode: z.string().max(40_000).default(""),
  currentFiles: z
    .record(z.string().max(120), z.string().max(40_000))
    .optional(),
  revision: z.number().int().min(0).max(10_000).default(0),
  conversation: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(8_000),
    actions: z.array(z.string().max(240)).max(12).optional(),
  })).max(40).optional(),
  provider: z.enum(AI_PROVIDER_IDS).default(defaultConfiguredAiProvider()),
  model: z.string().trim().min(1).max(160).optional(),
  smartModelRouting: z.boolean().default(false),
  providerFallback: z.boolean().default(true),
  importGraphIndex: z.boolean().default(true),
  trackUsage: z.boolean().default(true),
});

async function generateProjectFiles(input: z.infer<typeof generationInput>) {
  const params = {
    model: input.model,
    messages: buildGenerationMessages({
      prompt: input.prompt,
      currentCode: input.currentCode,
      currentFiles: input.currentFiles,
      revision: input.revision,
      conversation: input.conversation,
      importGraphIndex: input.importGraphIndex,
    }),
    maxTokens: 12_000,
    outputSchema: GENERATION_OUTPUT_SCHEMA,
  };
  const options: RoutingOptions = {
    smartModelRouting: input.smartModelRouting,
    providerFallback: input.providerFallback,
    prompt: input.prompt,
    currentFiles: input.currentFiles,
  };
  const invocation = await invokeRoutedLLM(input.provider, params, options);
  const result = invocation.result;
  const content = result.choices[0]?.message.content;
  const raw = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.filter((part): part is { type: "text"; text: string } => part.type === "text").map(part => part.text).join("\n")
      : "";
  const generated = parseGeneratedChange(raw);
  if (!generated) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La réponse IA est incomplète." });
  return { generated, invocation, params, raw };
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => (opts.ctx.user ? toPublicUser(opts.ctx.user) : null)),
    register: publicProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(120),
          email: z.string().trim().email().max(320),
          password: z.string().min(10).max(256),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (await db.getUserByEmail(input.email)) {
          throw new TRPCError({ code: "CONFLICT", message: "Un compte existe déjà pour cette adresse email." });
        }
        const user = await db.createLocalUser({
          name: input.name,
          email: input.email,
          passwordHash: await hashPassword(input.password),
        });
        const token = await createSessionToken(user);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: SESSION_MAX_AGE_MS,
        });
        return toPublicUser(user);
      }),
    login: publicProcedure
      .input(
        z.object({
          email: z.string().trim().email().max(320),
          password: z.string().min(1).max(256),
          remember: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByEmail(input.email);
        if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Adresse email ou mot de passe incorrect." });
        }
        const currentUser = (await db.touchUserLastSignedIn(user.id)) ?? user;
        const token = await createSessionToken(currentUser);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          ...(input.remember ? { maxAge: SESSION_MAX_AGE_MS } : {}),
        });
        return toPublicUser(currentUser);
      }),
    updateProfile: protectedProcedure
      .input(
        z.object({
          name: z.string().trim().min(2).max(120),
          email: z.string().trim().email().max(320),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await db.updateUserProfile(ctx.user.id, input);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Compte introuvable." });
        return toPublicUser(user);
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  ai: router({
    providers: publicProcedure.query(() => listAiProviders()),
    usage: protectedProcedure.query(({ ctx }) => db.listAiUsage(ctx.user.id, 100)),
    enhancePrompt: protectedProcedure
      .input(z.object({
        prompt: z.string().trim().min(4).max(2_000),
        provider: z.enum(AI_PROVIDER_IDS).default(defaultConfiguredAiProvider()),
        model: z.string().trim().min(1).max(160).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const invocation = await invokeRoutedLLM(input.provider, {
          model: input.model,
          maxTokens: 900,
          messages: [
            { role: "system", content: "Améliore la demande de développement fournie en conservant son intention. Retourne seulement le prompt réécrit, précis et actionnable, avec objectif, fonctionnalités, contraintes, état responsive et critères d’acceptation utiles. Ne réponds pas à la demande et n’ajoute aucune fonctionnalité non implicite." },
            { role: "user", content: input.prompt },
          ],
        }, { providerFallback: true, prompt: input.prompt });
        const response = invocation.result;
        const raw = response.choices[0]?.message.content;
        const prompt = typeof raw === "string" ? raw.trim() : "";
        if (prompt.length < 4) throw new TRPCError({ code: "BAD_GATEWAY", message: "Le provider n’a pas retourné de prompt amélioré." });
        const usage = ctx.user.role === "admin"
          ? { credits: ctx.user.credits }
          : await db.consumeCredit(ctx.user.id);
        if (!usage) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Vous n’avez plus de crédits IA disponibles." });
        return { prompt: prompt.slice(0, 2_000), credits: usage.credits };
      }),
    models: publicProcedure
      .input(z.object({ provider: z.enum(AI_PROVIDER_IDS) }))
      .query(({ input }) => listAiModels(input.provider)),
    testConnection: protectedProcedure
      .input(z.object({ provider: z.enum(AI_PROVIDER_IDS) }))
      .mutation(({ input }) => testAiProvider(input.provider)),
  }),

  deploy: router({
    preflight: protectedProcedure
      .input(z.object({ target: z.enum(["vercel", "netlify", "cloudflare"]) }))
      .query(({ input }) => deploymentPreflight(input.target)),
    publish: protectedProcedure
      .input(
        z.object({
          projectId: z.string().min(4).max(64),
          target: z.enum(["vercel", "netlify", "cloudflare"]),
          builtFiles: z.record(z.string().max(512), z.string().max(140_000_000)).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProject(ctx.user.id, input.projectId);
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable." });
        }
        const preflight = deploymentPreflight(input.target);
        if (!preflight.ready) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: preflight.message });
        }
        if (!input.builtFiles && !project.sourceFiles) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Ce projet ne contient aucun bundle statique à publier." });
        }
        let sourceFiles: DeploymentFiles;
        if (input.builtFiles) {
          const entries = Object.entries(input.builtFiles);
          const encodedBytes = entries.reduce((sum, [, content]) => sum + content.length, 0);
          if (entries.length > 20_000 || encodedBytes > 140_000_000) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Le build dépasse les limites de publication." });
          }
          if (entries.some(([, content]) => !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(content))) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Le build contient un fichier base64 invalide." });
          }
          sourceFiles = Object.fromEntries(entries.map(([path, content]) => [path, new Uint8Array(Buffer.from(content, "base64"))]));
        } else {
          try {
            sourceFiles = JSON.parse(project.sourceFiles!) as Record<string, string>;
          } catch {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Le bundle du projet est invalide." });
          }
        }
        await db.updateProject(ctx.user.id, project.id, {
          deploymentProvider: input.target,
          deploymentStatus: "building",
          deploymentError: null,
          deploymentUpdatedAt: new Date(),
        });
        try {
          const result = await deployFiles(input.target as DeploymentTarget, sourceFiles);
          const updated = await db.updateProject(ctx.user.id, project.id, {
            status: "Publié",
            deploymentProvider: input.target,
            deploymentId: result.deploymentId ?? null,
            deploymentUrl: result.url ?? null,
            deploymentStatus: result.status,
            deploymentError: result.status === "error" ? result.message : null,
            deployedRevision: project.revision,
            deploymentUpdatedAt: new Date(),
          });
          return { project: updated, result };
        } catch (error) {
          const message = error instanceof Error ? error.message : "Le déploiement a échoué.";
          await db.updateProject(ctx.user.id, project.id, {
            status: project.status === "Publié" ? "En cours" : project.status,
            deploymentProvider: input.target,
            deploymentStatus: "error",
            deploymentError: message.slice(0, 2_000),
            deploymentUpdatedAt: new Date(),
          });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
        }
      }),
  }),

  billing: router({
    createCheckout: protectedProcedure
      .input(
        z.object({
          plan: z.enum(["pro", "team"]),
          origin: z.string().url(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const origin = new URL(input.origin);
        if (origin.protocol !== "https:" && origin.protocol !== "http:") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Origine de paiement invalide.",
          });
        }
        const plan = BILLING_PLANS[input.plan];
        const session = await getStripe().checkout.sessions.create({
          mode: "subscription",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "eur",
                unit_amount: plan.priceCents,
                recurring: { interval: "month" },
                product_data: { name: `BuildFlow AI — ${plan.name}` },
              },
            },
          ],
          customer_email: ctx.user.email ?? undefined,
          client_reference_id: String(ctx.user.id),
          allow_promotion_codes: true,
          metadata: { user_id: String(ctx.user.id), plan: input.plan },
          subscription_data: {
            metadata: { user_id: String(ctx.user.id), plan: input.plan },
          },
          success_url: `${origin.origin}/billing?checkout=success`,
          cancel_url: `${origin.origin}/billing?checkout=cancelled`,
        });
        if (!session.url)
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Stripe n’a pas retourné d’URL de paiement.",
          });
        return { url: session.url };
      }),
    payments: protectedProcedure.query(({ ctx }) =>
      db.listPayments(ctx.user.id)
    ),
  }),

  projects: router({
    list: protectedProcedure.query(({ ctx }) => db.listProjects(ctx.user.id)),
    create: protectedProcedure
      .input(
        z.object({
          id: z.string().min(4).max(64),
          name: z.string().trim().min(1).max(160),
          type: z.string().trim().min(1).max(80),
          description: z.string().trim().min(1).max(10_000),
          status: z
            .enum(["Brouillon", "En cours", "Publié", "Archivé"])
            .default("En cours"),
          files: z.number().int().min(0).max(10_000).default(12),
          sourceFiles: z.string().max(4_000_000).optional(),
          revision: z.number().int().min(1).max(10_000).default(1),
          accent: z.string().max(32).default("#3B82F6"),
          gradient: z
            .string()
            .max(160)
            .default("from-blue-500/30 via-violet-500/10 to-transparent"),
          initials: z.string().max(8).default("BF"),
        })
      )
      .mutation(({ ctx, input }) =>
        db.createProject({ ...input, ownerId: ctx.user.id })
      ),
    createWithCredit: protectedProcedure
      .input(
        z.object({
          id: z.string().min(4).max(64),
          name: z.string().trim().min(1).max(160),
          type: z.string().trim().min(1).max(80),
          description: z.string().trim().min(1).max(10_000),
          status: z
            .enum(["Brouillon", "En cours", "Publié", "Archivé"])
            .default("En cours"),
          files: z.number().int().min(0).max(10_000).default(12),
          sourceFiles: z.string().max(4_000_000).optional(),
          revision: z.number().int().min(1).max(10_000).default(1),
          accent: z.string().max(32).default("#3B82F6"),
          gradient: z
            .string()
            .max(160)
            .default("from-blue-500/30 via-violet-500/10 to-transparent"),
          initials: z.string().max(8).default("BF"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "admin") {
          const project = await db.createProject({
            ...input,
            ownerId: ctx.user.id,
          });
          return {
            project,
            credits: ctx.user.credits,
            generationCount: ctx.user.generationCount,
          };
        }
        try {
          return await db.createProjectWithCredit(
            { ...input, ownerId: ctx.user.id },
            ctx.user.id
          );
        } catch (error) {
          if (error instanceof Error && error.message === "NO_CREDITS") {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "Vous n’avez plus de crédits IA disponibles.",
            });
          }
          throw error;
        }
      }),
    createAndGenerate: protectedProcedure
      .input(
        z.object({
          id: z.string().min(4).max(64),
          name: z.string().trim().min(1).max(160),
          type: z.string().trim().min(1).max(80),
          description: z.string().trim().min(1).max(10_000),
          prompt: z.string().trim().min(12).max(4_000),
          provider: z.enum(AI_PROVIDER_IDS).default(defaultConfiguredAiProvider()),
          model: z.string().trim().min(1).max(160).optional(),
          templateId: z.enum(STARTER_TEMPLATE_IDS).optional(),
          smartModelRouting: z.boolean().default(false),
          providerFallback: z.boolean().default(true),
          importGraphIndex: z.boolean().default(true),
          trackUsage: z.boolean().default(true),
          accent: z.string().max(32).default("#3B82F6"),
          gradient: z.string().max(160).default("from-blue-500/30 via-violet-500/10 to-transparent"),
          initials: z.string().max(8).default("BF"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const starterFiles = input.templateId
          ? getStarterTemplateFiles(input.templateId)
          : {};
        const baseProject = {
          id: input.id,
          name: input.name,
          type: input.type,
          description: input.description,
          status: "En cours" as const,
          files: Object.keys(starterFiles).length,
          ...(Object.keys(starterFiles).length ? { sourceFiles: JSON.stringify(starterFiles) } : {}),
          revision: 1,
          accent: input.accent,
          gradient: input.gradient,
          initials: input.initials,
          ownerId: ctx.user.id,
        };
        let project;
        let credits = ctx.user.credits;
        let generationCount = ctx.user.generationCount;
        if (ctx.user.role === "admin") {
          project = await db.createProject(baseProject);
        } else {
          const created = await db.createProjectWithCredit(baseProject, ctx.user.id);
          project = created.project;
          credits = created.credits;
          generationCount = created.generationCount;
        }
        try {
          const generation = await generateProjectFiles({
            prompt: input.prompt,
            provider: input.provider,
            model: input.model,
            currentCode: starterFiles["src/App.tsx"] ?? "",
            currentFiles: starterFiles,
            revision: starterFiles["src/App.tsx"] ? 1 : 0,
            smartModelRouting: input.smartModelRouting,
            providerFallback: input.providerFallback,
            importGraphIndex: input.importGraphIndex,
            trackUsage: input.trackUsage,
          });
          const generated = generation.generated;
          const generatedFiles = Object.fromEntries(
            (generated.files?.length ? generated.files : [{ path: "src/App.tsx", content: generated.code }]).map(file => [file.path, file.content])
          );
          const files = { ...starterFiles, ...generatedFiles };
          project = (await db.updateProject(ctx.user.id, input.id, {
            sourceFiles: JSON.stringify(files),
            files: Object.keys(files).length,
            revision: 1,
            status: "En cours",
          })) ?? project;
          if (input.trackUsage) {
            const fields = usageRecordFields(generation.invocation.metadata, generation.params, generation.raw, generation.invocation.result);
            await db.createAiUsage({
              id: randomUUID(), ownerId: ctx.user.id, projectId: input.id,
              ...fields, tokenCountsEstimated: fields.tokenCountsEstimated ? 1 : 0,
            }).catch(error => console.warn("[AI usage] Initial generation usage could not be saved:", error));
          }
          try {
            await db.createProjectMessage({
              ownerId: ctx.user.id,
              projectId: input.id,
              role: "user",
              content: input.prompt,
              actions: null,
            });
            await db.createProjectMessage({
              ownerId: ctx.user.id,
              projectId: input.id,
              role: "assistant",
              content: generated.assistantMessage,
              actions: generated.changes,
            });
          } catch (error) {
            console.error("[Conversation] Initial history could not be saved:", error);
          }
          return { project, credits, generationCount, ...generated, previewRevision: 1 };
        } catch (error) {
          await db.updateProject(ctx.user.id, input.id, { status: "Brouillon" });
          throw error;
        }
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.string().min(4).max(64),
          name: z.string().trim().min(1).max(160).optional(),
          description: z.string().trim().min(1).max(10_000).optional(),
          status: z
            .enum(["Brouillon", "En cours", "Publié", "Archivé"])
            .optional(),
          files: z.number().int().min(0).max(10_000).optional(),
          sourceFiles: z.string().max(4_000_000).optional(),
          revision: z.number().int().min(1).max(10_000).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { id, ...patch } = input;
        return db.updateProject(ctx.user.id, id, patch);
      }),
    remove: protectedProcedure
      .input(z.object({ id: z.string().min(4).max(64) }))
      .mutation(({ ctx, input }) => db.deleteProject(ctx.user.id, input.id)),
    consumeCredit: protectedProcedure.mutation(async ({ ctx }) => {
      if (ctx.user.role === "admin") {
        return {
          success: true as const,
          credits: ctx.user.credits,
          generationCount: ctx.user.generationCount,
        };
      }
      const usage = await db.consumeCredit(ctx.user.id);
      if (!usage)
        return { success: false as const, credits: 0, generationCount: 0 };
      return { success: true as const, ...usage };
    }),
    generateChange: protectedProcedure
      .input(
        z.object({
          projectId: z.string().min(4).max(64),
          prompt: z.string().trim().min(2).max(2_000),
          currentCode: z.string().max(40_000),
          currentFiles: z
            .record(z.string().max(120), z.string().max(40_000))
            .optional(),
          revision: z.number().int().min(0).max(10_000),
          provider: z.enum(AI_PROVIDER_IDS).default(defaultConfiguredAiProvider()),
          model: z.string().trim().min(1).max(160).optional(),
          smartModelRouting: z.boolean().default(false),
          providerFallback: z.boolean().default(true),
          importGraphIndex: z.boolean().default(true),
          trackUsage: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProject(ctx.user.id, input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable." });
        const storedMessages = await db.listProjectMessages(ctx.user.id, input.projectId);
        const lastStored = storedMessages.at(-1);
        const priorMessages = lastStored?.role === "user" && lastStored.content === input.prompt
          ? storedMessages.slice(0, -1)
          : storedMessages;
        const params = {
          model: input.model,
          messages: buildGenerationMessages({
            prompt: input.prompt,
            currentCode: input.currentCode,
            currentFiles: input.currentFiles ?? { "src/App.tsx": input.currentCode },
            revision: input.revision,
            conversation: priorMessages
              .filter(message => message.role === "user" || message.role === "assistant")
              .map(message => ({ role: message.role as "user" | "assistant", content: message.content, actions: message.actions })),
            importGraphIndex: input.importGraphIndex,
          }),
          maxTokens: 12_000,
          outputSchema: GENERATION_OUTPUT_SCHEMA,
        };
        const invocation = await invokeRoutedLLM(input.provider, params, {
          smartModelRouting: input.smartModelRouting,
          providerFallback: input.providerFallback,
          prompt: input.prompt,
          currentFiles: input.currentFiles ?? { "src/App.tsx": input.currentCode },
        });
        const result = invocation.result;
        const content = result.choices[0]?.message.content;
        const raw =
          typeof content === "string"
            ? content
            : Array.isArray(content)
              ? content
                  .filter(
                    (part): part is { type: "text"; text: string } =>
                      part.type === "text"
                  )
                  .map(part => part.text)
                  .join("\n")
              : "";
        const generated = parseGeneratedChange(raw);
        if (!generated) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "La réponse IA est incomplète.",
          });
        }
        const usage =
          ctx.user.role === "admin"
            ? {
                credits: ctx.user.credits,
                generationCount: ctx.user.generationCount,
              }
            : await db.consumeCredit(ctx.user.id);
        if (!usage)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Vous n’avez plus de crédits IA disponibles.",
          });
        if (input.trackUsage) {
          const fields = usageRecordFields(invocation.metadata, params, raw, result);
          await db.createAiUsage({
            id: randomUUID(), ownerId: ctx.user.id, projectId: input.projectId,
            ...fields, tokenCountsEstimated: fields.tokenCountsEstimated ? 1 : 0,
          }).catch(error => console.warn("[AI usage] Project generation usage could not be saved:", error));
        }
        return { ...generated, previewRevision: input.revision + 1, ...usage };
      }),
  }),
  attachments: router({
    upload: protectedProcedure
      .input(z.object({
        projectId: z.string().min(4).max(64),
        fileName: z.string().trim().min(1).max(240),
        mimeType: z.enum(IMAGE_MIME_TYPES),
        dataBase64: z.string().min(4).max(MAX_IMAGE_BASE64_CHARS),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProject(ctx.user.id, input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable." });
        if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.dataBase64)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Le fichier image est invalide." });
        }
        const bytes = new Uint8Array(Buffer.from(input.dataBase64, "base64"));
        if (bytes.byteLength > MAX_IMAGE_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "Une image doit peser au maximum 4 Mio." });
        const fileName = input.fileName.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 240) || "image";
        const id = randomUUID();
        try {
          const storageKey = createImageStorageKey(input.mimeType, bytes);
          const attachment = await db.createProjectAttachment({
            id,
            ownerId: ctx.user.id,
            projectId: project.id,
            storageKey,
            originalName: fileName,
            mimeType: input.mimeType,
            size: bytes.byteLength,
            fileData: Buffer.from(bytes),
          });
          return { id: attachment.id, name: attachment.originalName, mimeType: input.mimeType, size: attachment.size, url: `/api/attachments/${attachment.id}` };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Impossible d’enregistrer cette image." });
        }
      }),
  }),
  snapshots: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.string().min(4).max(64) }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProject(ctx.user.id, input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable." });
        return db.listProjectSnapshots(ctx.user.id, input.projectId);
      }),
    get: protectedProcedure
      .input(z.object({ snapshotId: z.string().uuid() }))
      .query(async ({ ctx, input }) => {
        const snapshot = await db.getProjectSnapshot(ctx.user.id, input.snapshotId);
        if (!snapshot) throw new TRPCError({ code: "NOT_FOUND", message: "Snapshot introuvable." });
        try { return { ...snapshot, files: parseSnapshotFiles(snapshot.files) }; }
        catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le snapshot enregistré est invalide." }); }
      }),
    create: protectedProcedure
      .input(z.object({ projectId: z.string().min(4).max(64), label: z.string().trim().min(1).max(320), files: z.record(z.string().max(512), z.string().max(100_000)) }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProject(ctx.user.id, input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable." });
        let serialized: string;
        try { serialized = serializeSnapshotFiles(input.files); }
        catch (error) { throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Snapshot invalide." }); }
        const snapshot = await db.createProjectSnapshot({ ownerId: ctx.user.id, projectId: project.id, label: input.label, files: serialized });
        return { id: snapshot.id, label: snapshot.label, createdAt: snapshot.createdAt };
      }),
    restore: protectedProcedure
      .input(z.object({ snapshotId: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const snapshot = await db.getProjectSnapshot(ctx.user.id, input.snapshotId);
        if (!snapshot) throw new TRPCError({ code: "NOT_FOUND", message: "Snapshot introuvable." });
        const project = await db.getProject(ctx.user.id, snapshot.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable." });
        let files: Record<string, string>;
        try { files = parseSnapshotFiles(snapshot.files); }
        catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Le snapshot enregistré est invalide." }); }
        await db.updateProject(ctx.user.id, project.id, { sourceFiles: JSON.stringify(files), files: Object.keys(files).length, revision: project.revision + 1 });
        return { snapshotId: snapshot.id, files, revision: project.revision + 1 };
      }),
  }),
  messages: router({
    list: protectedProcedure
      .input(z.object({ projectId: z.string().min(4).max(64) }))
      .query(async ({ ctx, input }) => {
        const project = await db.getProject(ctx.user.id, input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable." });
        return db.listProjectMessages(ctx.user.id, input.projectId);
      }),
    append: protectedProcedure
      .input(z.object({
        projectId: z.string().min(4).max(64),
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().trim().min(1).max(40_000),
        actions: z.array(z.string().trim().min(1).max(240)).max(12).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const project = await db.getProject(ctx.user.id, input.projectId);
        if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Projet introuvable." });
        return db.createProjectMessage({
          ownerId: ctx.user.id,
          projectId: input.projectId,
          role: input.role,
          content: input.content,
          actions: input.actions ?? null,
        });
      }),
  }),
  research: router({
    sources: protectedProcedure
      .input(z.object({ projectId: z.string().min(4).max(64).optional() }))
      .query(({ ctx, input }) =>
        db.listResearchSources(ctx.user.id, input.projectId)
      ),
    addSource: protectedProcedure
      .input(
        z.object({
          projectId: z.string().min(4).max(64).optional(),
          url: z.string().url().max(2_048),
          title: z.string().trim().max(320).optional(),
          topic: z.string().trim().min(2).max(160),
          trustScore: z.number().int().min(0).max(100).default(50),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (
          input.projectId &&
          !(await db.getProject(ctx.user.id, input.projectId))
        )
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Projet introuvable.",
          });
        return db.createResearchSource({
          id: randomUUID(),
          ownerId: ctx.user.id,
          projectId: input.projectId ?? null,
          url: input.url,
          title: input.title ?? null,
          topic: input.topic,
          trustScore: input.trustScore,
          active: 1,
        });
      }),
    run: protectedProcedure
      .input(
        z.object({
          projectId: z.string().min(4).max(64).optional(),
          query: z.string().trim().min(8).max(2_000),
          sources: z
            .array(
              z.object({
                url: z.string().url().max(2_048),
                title: z.string().max(320).optional(),
                trustScore: z.number().int().min(0).max(100).optional(),
              })
            )
            .min(1)
            .max(8),
          agentRoles: z
            .array(z.string().trim().min(2).max(120))
            .max(10)
            .optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (input.projectId) {
          const project = await db.getProject(ctx.user.id, input.projectId);
          if (!project)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Projet introuvable.",
            });
        }
        const usage =
          ctx.user.role === "admin"
            ? {
                credits: ctx.user.credits,
                generationCount: ctx.user.generationCount,
              }
            : await db.consumeCredit(ctx.user.id);
        if (!usage)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Vous n’avez plus de crédits IA disponibles pour cette recherche.",
          });
        try {
          const result = await runAdvancedResearch(input);
          await db.createResearchRun({
            id: result.runId,
            ownerId: ctx.user.id,
            projectId: input.projectId,
            query: input.query,
            status: "completed",
            findings: JSON.stringify({
              summary: result.summary,
              recommendations: result.recommendations,
              risks: result.risks,
            }),
            citations: JSON.stringify(result.citations),
          });
          await Promise.all(
            result.memories.map(memory =>
              db.upsertAgentMemory({
                id: `${ctx.user.id}-${input.projectId ?? "global"}-${memory.agentRole}-${memory.key}`.slice(
                  0,
                  64
                ),
                ownerId: ctx.user.id,
                projectId: input.projectId ?? null,
                agentRole: memory.agentRole,
                key: memory.key,
                content: memory.content,
                confidence: memory.confidence,
                sourceRunId: result.runId,
              })
            )
          );
          return { ...result, ...usage };
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              error instanceof Error
                ? error.message
                : "La recherche avancée a échoué.",
          });
        }
      }),
    history: protectedProcedure
      .input(z.object({ projectId: z.string().min(4).max(64).optional() }))
      .query(({ ctx, input }) =>
        db.listResearchRuns(ctx.user.id, input.projectId)
      ),
    memories: protectedProcedure
      .input(z.object({ projectId: z.string().min(4).max(64).optional() }))
      .query(({ ctx, input }) =>
        db.listAgentMemories(ctx.user.id, input.projectId)
      ),
  }),
});

export type AppRouter = typeof appRouter;
