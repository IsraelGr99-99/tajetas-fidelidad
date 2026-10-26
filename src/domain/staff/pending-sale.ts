import { z } from "zod";

export const PENDING_SALE_KEY = "iautomexa:pending-pos-sale-v1";
const sale = z.object({
  branchId: z.uuid(),
  key: z.uuid(),
  lines: z.array(z.object({ product_id: z.uuid(), quantity: z.number().int().min(1).max(100) })).min(1).max(50),
  paymentMethod: z.enum(["cash", "card_manual", "transfer_manual"]),
  cashReceived: z.string().max(20),
  savedAt: z.number().int().nonnegative(),
});

export type PendingSale = z.infer<typeof sale>;

/** Una operación sin respuesta debe reintentarse con la misma clave y los mismos datos. */
export function parsePendingSale(raw: string | null, branchId: string): PendingSale | null {
  if (!raw) return null;
  try {
    const parsed = sale.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.branchId === branchId ? parsed.data : null;
  } catch {
    return null;
  }
}
