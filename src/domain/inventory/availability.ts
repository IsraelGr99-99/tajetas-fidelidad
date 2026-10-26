export type RecipePart = { product_id: string; item_id: string; quantity: number };
export type StockBalance = { branch_id: string; item_id: string; quantity: number; minimum: number };

/** Estimación informativa. La venta confirma y descuenta el carrito en PostgreSQL. */
export function estimateProductAvailability(productId: string, branchId: string, recipes: RecipePart[], balances: StockBalance[]): number | null {
  const parts = recipes.filter((part) => part.product_id === productId);
  if (!parts.length) return null;
  return Math.max(0, Math.floor(Math.min(...parts.map((part) => {
    const balance = balances.find((row) => row.branch_id === branchId && row.item_id === part.item_id);
    return (balance?.quantity ?? 0) / part.quantity;
  }))));
}
