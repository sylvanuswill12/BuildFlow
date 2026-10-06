export type SupportedImageMimeType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";
export type UploadedImage = {
  id: string;
  name: string;
  mimeType: SupportedImageMimeType;
  size: number;
  url: string;
};

export const MAX_IMAGE_ATTACHMENT_BYTES = 4 * 1024 * 1024;

const PREFIX = "buildflow-image:";
export function serializeImageAttachment(image: Pick<UploadedImage, "id" | "name" | "mimeType">) {
  return `${PREFIX}${image.id}|${image.mimeType}|${encodeURIComponent(image.name)}`.slice(0, 240);
}

export function parseImageAttachments(actions: string[] | null | undefined): UploadedImage[] {
  return (actions ?? []).flatMap(action => {
    if (!action.startsWith(PREFIX)) return [];
    const [id, mimeType, encodedName] = action.slice(PREFIX.length).split("|");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mimeType ?? "")) return [];
    let name = "image";
    try { name = decodeURIComponent(encodedName ?? "image").slice(0, 160) || "image"; } catch { /* Keep the fallback name. */ }
    return [{ id, name, mimeType: mimeType as SupportedImageMimeType, size: 0, url: `/api/attachments/${id}` }];
  });
}
