import { randomUUID } from "node:crypto";
import { invokeLLM } from "./_core/llm";

export type ResearchSourceInput = {
  url: string;
  title?: string;
  trustScore?: number;
};
export type ResearchCitation = {
  url: string;
  title: string;
  excerpt: string;
  fetchedAt: string;
};
export type ResearchMemory = {
  agentRole: string;
  key: string;
  content: string;
  confidence: number;
};
export type ResearchResult = {
  runId: string;
  query: string;
  summary: string;
  recommendations: string[];
  risks: string[];
  memories: ResearchMemory[];
  citations: ResearchCitation[];
};

type FetchedSource = ResearchCitation & { text: string; trustScore: number };

function normalizeUrl(raw: string) {
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Seules les URLs HTTP(S) sont acceptées.");
  return url.toString();
}

function extractReadableText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50_000);
}

async function fetchSource(
  source: ResearchSourceInput
): Promise<FetchedSource | null> {
  const url = normalizeUrl(source.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "BuildFlow-Research/1.0 (+https://buildflow.ai)",
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (
      !contentType.includes("text/html") &&
      !contentType.includes("text/plain")
    )
      return null;
    const html = await response.text();
    const text = extractReadableText(html);
    if (text.length < 80) return null;
    return {
      url,
      title: source.title ?? new URL(url).hostname,
      excerpt: text.slice(0, 360),
      text,
      trustScore: Math.max(0, Math.min(100, source.trustScore ?? 50)),
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runAdvancedResearch(input: {
  query: string;
  sources: ResearchSourceInput[];
  agentRoles?: string[];
}): Promise<ResearchResult> {
  const deduplicated = Array.from(
    new Map(input.sources.map(source => [source.url, source])).values()
  ).slice(0, 8);
  const fetched = (await Promise.all(deduplicated.map(fetchSource))).filter(
    (source): source is FetchedSource => Boolean(source)
  );
  if (fetched.length === 0) {
    throw new Error(
      "Aucune source lisible. Ajoutez des URLs publiques fiables à la veille."
    );
  }

  const sourceContext = fetched
    .map(
      (source, index) =>
        `[SOURCE ${index + 1}] ${source.title} (${source.url})\nFiabilité déclarée: ${source.trustScore}/100\n${source.text}`
    )
    .join("\n\n");
  const roles = input.agentRoles?.length
    ? input.agentRoles
    : [
        "Product Strategist",
        "System Architect",
        "Experience Designer",
        "Art Director",
        "Frontend Builder",
        "Quality Guardian",
      ];
  const response = await invokeLLM({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `Tu es le Research Council de BuildFlow AI. Tu analyses des sources publiques, tu distingues les faits des hypothèses, tu cites toujours les sources par leur URL et tu produis des recommandations concrètes pour créer des applications web sophistiquées. Les rôles concernés sont: ${roles.join(", ")}. N'invente jamais une information absente des sources.`,
      },
      {
        role: "user",
        content: `Question de recherche:\n${input.query}\n\nSources:\n${sourceContext}`,
      },
    ],
    maxTokens: 8_000,
    outputSchema: {
      name: "buildflow_research",
      strict: true,
      schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          recommendations: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 10,
          },
          risks: { type: "array", items: { type: "string" }, maxItems: 8 },
          memories: {
            type: "array",
            items: {
              type: "object",
              properties: {
                agentRole: { type: "string" },
                key: { type: "string" },
                content: { type: "string" },
                confidence: { type: "integer", minimum: 0, maximum: 100 },
              },
              required: ["agentRole", "key", "content", "confidence"],
              additionalProperties: false,
            },
            maxItems: 24,
          },
        },
        required: ["summary", "recommendations", "risks", "memories"],
        additionalProperties: false,
      },
    },
  });
  const content = response.choices[0]?.message.content;
  const raw =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .filter(part => part.type === "text")
            .map(part => part.text)
            .join("\n")
        : "";
  const parsed = JSON.parse(raw) as Omit<
    ResearchResult,
    "runId" | "query" | "citations"
  >;
  return {
    runId: randomUUID(),
    query: input.query,
    ...parsed,
    citations: fetched.map(
      ({ text: _text, trustScore: _trustScore, ...citation }) => citation
    ),
  };
}
