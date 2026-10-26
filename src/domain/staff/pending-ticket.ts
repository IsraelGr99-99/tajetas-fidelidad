import { z } from "zod";

export const PENDING_TICKET_KEY = "iautomexa:pending-loyalty-v1";
const MAX_AGE_MS = 30 * 60 * 1000;
const schema = z.object({
  branchId: z.uuid(),
  folio: z.uuid(),
  items: z.array(z.object({ product_id: z.uuid(), quantity: z.number().int().min(1).max(100) })).min(1).max(50),
  savedAt: z.number().int().nonnegative(),
});

export type PendingTicket = z.infer<typeof schema>;

/** Pista local de captura; nunca sustituye la validación de la RPC de fidelidad. */
export function parsePendingTicket(raw: string | null, branchId: string, now = Date.now()): PendingTicket | null {
  if (!raw) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.branchId !== branchId || parsed.data.savedAt > now || now - parsed.data.savedAt > MAX_AGE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}
