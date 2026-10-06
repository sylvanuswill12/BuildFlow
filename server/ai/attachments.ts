import type { ImageContent, Message } from "../aiTypes";

export type StoredGenerationImage = { mimeType: string; bytes: Uint8Array };

export function attachImagesToLastUserMessage(messages: Message[], images: StoredGenerationImage[]): Message[] {
  if (!images.length) return messages;
  const targetIndex = messages.findLastIndex(message => message.role === "user");
  if (targetIndex < 0) throw new Error("Aucun message utilisateur pour les images jointes.");
  const imageBlocks: ImageContent[] = images.map(image => ({
    type: "image_url",
    image_url: { url: `data:${image.mimeType};base64,${Buffer.from(image.bytes).toString("base64")}`, detail: "auto" },
  }));
  return messages.map((message, index) => {
    if (index !== targetIndex) return message;
    const priorParts = typeof message.content === "string"
      ? [{ type: "text" as const, text: message.content }]
      : Array.isArray(message.content)
        ? message.content.flatMap(part => typeof part === "string" ? [{ type: "text" as const, text: part }] : [part])
        : [message.content];
    return { ...message, content: [...imageBlocks, ...priorParts] };
  });
}
