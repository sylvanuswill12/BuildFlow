export type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  actions?: string[] | null;
};

export type ConversationContext = {
  summary?: string;
  recent: ConversationMessage[];
};

const DEFAULT_WINDOW_SIZE = 12;
const DEFAULT_CHAR_BUDGET = 12_000;
const SUMMARY_LINE_LIMIT = 180;

function oneLine(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function buildConversationContext(
  messages: ConversationMessage[],
  options: { windowSize?: number; charBudget?: number } = {}
): ConversationContext {
  const windowSize = Math.max(1, options.windowSize ?? DEFAULT_WINDOW_SIZE);
  const charBudget = Math.max(1_000, options.charBudget ?? DEFAULT_CHAR_BUDGET);
  const recent = messages.slice(-windowSize).map(message => ({
    role: message.role,
    content: message.content,
    ...(message.actions?.length ? { actions: message.actions } : {}),
  }));
  let used = recent.reduce((sum, message) => sum + message.content.length, 0);
  while (recent.length > 1 && used > charBudget) {
    const removed = recent.shift();
    if (removed) used -= removed.content.length;
  }
  if (recent.length === 1 && recent[0]!.content.length > charBudget) {
    recent[0] = {
      ...recent[0]!,
      content: recent[0]!.content.slice(-charBudget),
    };
  }
  const older = messages.slice(0, messages.length - recent.length);
  const summary = older.length
    ? older
        .map(message => {
          const role = message.role === "user" ? "Demande" : "Réponse";
          const content = oneLine(message.content).slice(0, SUMMARY_LINE_LIMIT);
          const actions = message.actions?.length ? ` (actions : ${message.actions.slice(0, 4).join(", ")})` : "";
          return `- ${role} : ${content}${actions}`;
        })
        .filter(line => line.length > 12)
        .join("\n")
        .slice(-4_000)
    : undefined;
  return { ...(summary ? { summary } : {}), recent };
}
