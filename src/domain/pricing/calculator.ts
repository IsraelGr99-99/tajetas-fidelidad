/**
 * Estimación de precio por unidad. Todos los montos persisten en centavos MXN;
 * la tasa de impuesto es una entrada del negocio, no una regla fiscal inferida.
 */
export type IngredientCost = { quantity: number; unitCostCents: number };
export type PricingInput = {
  ingredients: IngredientCost[];
  laborCents: number;
  packagingCents: number;
  overheadCents: number;
  wastePercent: number;
  targetMarginPercent: number;
  taxPercent: number;
};

export type PricingResult = {
  ingredientsCents: number;
  wasteCents: number;
  totalCostCents: number;
  netPriceCents: number;
  taxCents: number;
  finalPriceCents: number;
  grossProfitCents: number;
  actualMarginPercent: number;
};

export function calculateProductPrice(input: PricingInput): PricingResult | null {
  const amounts = [input.laborCents, input.packagingCents, input.overheadCents];
  const rates = [input.wastePercent, input.targetMarginPercent, input.taxPercent];
  if (amounts.some((n) => !Number.isSafeInteger(n) || n < 0 || n > 100_000_000)) return null;
  if (rates.some((n) => !Number.isFinite(n) || n < 0 || n > 100) || input.targetMarginPercent >= 100) return null;
  if (!Array.isArray(input.ingredients) || input.ingredients.length > 100) return null;
  if (input.ingredients.some((i) => !Number.isFinite(i.quantity) || i.quantity < 0 || i.quantity > 1_000_000 || !Number.isSafeInteger(i.unitCostCents) || i.unitCostCents < 0 || i.unitCostCents > 100_000_000)) return null;

  const ingredientsCents = Math.round(input.ingredients.reduce((sum, i) => sum + i.quantity * i.unitCostCents, 0));
  const wasteCents = Math.round(ingredientsCents * input.wastePercent / 100);
  const totalCostCents = ingredientsCents + wasteCents + input.laborCents + input.packagingCents + input.overheadCents;
  if (!Number.isSafeInteger(totalCostCents) || totalCostCents <= 0) return null;
  const netPriceCents = Math.ceil(totalCostCents / (1 - input.targetMarginPercent / 100));
  const taxCents = Math.round(netPriceCents * input.taxPercent / 100);
  const finalPriceCents = netPriceCents + taxCents;
  if (![netPriceCents, taxCents, finalPriceCents].every(Number.isSafeInteger)) return null;
  return {
    ingredientsCents,
    wasteCents,
    totalCostCents,
    netPriceCents,
    taxCents,
    finalPriceCents,
    grossProfitCents: netPriceCents - totalCostCents,
    actualMarginPercent: (netPriceCents - totalCostCents) / netPriceCents * 100,
  };
}
