import type { Message, OutputSchema } from "../aiTypes";
import { buildConversationContext, type ConversationMessage } from "../messageHistory";
import { selectRelevantFiles } from "./relevantFiles";
import type { AgentMode } from "../../shared/agentActions";

export const GENERATION_SYSTEM_PROMPT = `Tu es l’agent BuildFlow, un ingénieur logiciel senior qui crée et répare de vraies applications.

Environnement imposé : application React 19 + TypeScript + Vite, exécutée dans un WebContainer. L’entrée React est src/App.tsx et le bootstrap est src/main.tsx. Ne génère jamais de structure Next.js, de route app/page.tsx ou de fichier page.tsx comme entrée. Génère des chemins réels depuis la racine du projet, par exemple src/App.tsx, src/components/TodoList.tsx, src/index.css, package.json, vite.config.ts, tsconfig.json et index.html.

Réponds uniquement avec l’objet JSON conforme au schéma. Le champ code reprend le contenu final de src/App.tsx (ou le fichier actif si une autre cible est explicitement demandée). Le champ files contient uniquement les fichiers à créer ou modifier avec leur contenu complet. N’ajoute pas les fichiers inchangés. Déclare dans package.json toutes les dépendances nécessaires et préserve scripts/dependencies existants. Garanties : code compilable avec Vite, imports/exports et chemins vérifiés, pas de secrets, pas de modules inventés, pas de pseudo-implémentations. Implémente vraiment les interactions demandées. Lors d’une modification ou correction, conserve l’architecture, les fonctionnalités et les noms des fichiers existants, cible la cause précise et limite les changements au nécessaire.`;

export const GENERATION_OUTPUT_SCHEMA: OutputSchema = {
  name: "buildflow_generation",
  strict: true,
  schema: {
    type: "object",
    properties: {
      code: { type: "string" },
      changes: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        maxItems: 8,
      },
      assistantMessage: { type: "string" },
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" },
          },
          required: ["path", "content"],
          additionalProperties: false,
        },
        minItems: 1,
        maxItems: 24,
      },
    },
    required: ["code", "changes", "assistantMessage", "files"],
    additionalProperties: false,
  },
};

export type GenerationContext = {
  prompt: string;
  currentCode?: string;
  currentFiles?: Record<string, string>;
  revision?: number;
  conversation?: ConversationMessage[];
  activeFile?: string;
  mode?: AgentMode;
  importGraphIndex?: boolean;
};

export function buildGenerationMessages(context: GenerationContext): Message[] {
  const history = buildConversationContext(context.conversation ?? []);
  const currentFiles = context.currentFiles ?? {};
  const relevantFiles = selectRelevantFiles(currentFiles, context.prompt, context.activeFile, context.importGraphIndex ?? true);
  return [
    { role: "system", content: GENERATION_SYSTEM_PROMPT },
    ...(history.summary
      ? [{ role: "system" as const, content: `Résumé de la conversation précédente :\n${history.summary}` }]
      : []),
    ...history.recent.map(message => ({
      role: message.role,
      content: message.actions?.length
        ? `${message.content}\nActions effectuées : ${message.actions.join("; ")}`
        : message.content,
    })),
    {
      role: "user",
      content: [
        `Demande utilisateur :\n${context.prompt}`,
        `Mode de l’agent : ${context.mode ?? "build"}`,
        `Révision actuelle : ${context.revision ?? 0}`,
        `Fichier actif ${context.activeFile ?? "src/App.tsx"} :\n${context.currentCode ?? ""}`,
        `Arborescence du projet (tous les chemins relatifs à la racine) :\n${Object.keys(currentFiles).join("\n")}`,
        `Contenu des fichiers pertinents (ensemble borné) :\n${JSON.stringify(relevantFiles, null, 2)}`,
      ].join("\n\n"),
    },
  ];
}

export function buildActionStreamMessages(context: GenerationContext): Message[] {
  const messages = buildGenerationMessages(context);
  const modeInstruction = context.mode === "plan"
    ? "Mode Plan : clarifie les objectifs, décompose le travail et propose des étapes/critères d’acceptation. N’écris, ne supprime ni n’exécute aucun fichier/commande; termine avec une action message seulement."
    : context.mode === "discussion"
      ? "Mode Discussion : réponds aux questions, explique ou conseille sans modifier le projet et sans exécuter de commande; termine avec une action message seulement."
      : "Mode Build : implémente concrètement la demande dans le projet et vérifie le résultat.";
  messages.splice(1, 0, {
    role: "system",
    content: `Pour cette requête en streaming, remplace la consigne JSON précédente par le protocole d’actions brut ci-dessous. N’utilise ni JSON englobant ni bloc Markdown. Émets une action complète à la fois, dès qu’elle est prête, et uniquement les fichiers modifiés. ${modeInstruction}\n<file path="src/App.tsx">contenu complet du fichier</file>\n<patch path="src/App.tsx">{"search":"texte exact à remplacer","replace":"texte de remplacement"}</patch>\n<shell>commande shell courte de vérification</shell>\n<delete path="src/inutilisé.ts"/>\n<message>résumé destiné à l’utilisateur</message>\nLes chemins sont relatifs à la racine. Le contenu des actions file conserve les retours de ligne du fichier. Préfère file pour une création complète; patch exige un extrait exact. Le shell ne doit ni publier ni accéder à des secrets. Les actions shell suivent les fichiers nécessaires. Termine toujours avec message.`,
  });
  return messages;
}
