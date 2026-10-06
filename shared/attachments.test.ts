import { describe, expect, it } from "vitest";
import { parseImageAttachments, serializeImageAttachment } from "./attachments";

const image = { id: "8d8622c9-f48b-4f25-89e1-860af8e832d1", name: "maquette été.png", mimeType: "image/png" as const };

describe("chat image attachment references", () => {
  it("round-trips metadata through the message action field", () => {
    const result = parseImageAttachments(["modification appliquée", serializeImageAttachment(image)]);
    expect(result).toEqual([{ ...image, size: 0, url: `/api/attachments/${image.id}` }]);
  });
  it("ignores malformed or unknown action strings", () => {
    expect(parseImageAttachments(["buildflow-image:not-a-uuid|image/png|x", "random"])).toEqual([]);
  });
});
