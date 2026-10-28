import { z } from "zod";

export const demoBusinessSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del negocio.").max(120),
  branchName: z.string().trim().min(2, "Escribe el nombre de la sucursal.").max(120),
  slug: z.string().trim().max(60).optional(),
});

export function toBusinessSlug(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60).replace(/-$/, "");
}
