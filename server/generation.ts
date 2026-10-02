import { z } from "zod";

export const generatedChangeSchema = z.object({
  code: z.string().trim().min(1).max(40_000),
  changes: z.array(z.string().trim().min(1).max(240)).min(1).max(6),
  assistantMessage: z.string().trim().min(1).max(2_000),
  files: z
    .array(
      z
        .object({
          path: z
            .string()
            .regex(/^[a-zA-Z0-9._/-]+$/, "Chemin de fichier invalide")
            .refine(
              value => !value.startsWith("/") && !value.split("/").includes(".."),
              "Chemin de fichier hors workspace"
            ),
          content: z.string().trim().min(1).max(40_000),
        })
        .strict()
    )
    .max(12, "Trop de fichiers générés")
    .optional(),
}).strict();

export type GeneratedChange = z.infer<typeof generatedChangeSchema>;

export function parseGeneratedChange(raw: string): GeneratedChange | null {
  try {
    const parsed = generatedChangeSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
