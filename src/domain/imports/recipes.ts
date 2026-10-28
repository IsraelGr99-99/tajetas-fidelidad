import { normalizeHeader, type Cell } from "./spreadsheet";

export type RecipeCatalogProduct = { id: string; name: string };
export type RecipeStockItem = { id: string; name: string; unit: string };
export type RecipeImportGroup = { productId: string; productName: string; components: { item_id: string; quantity: number }[] };

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("es-MX");
const unsafeName = (value: string) => /[<>\u0000-\u001f]/.test(value) || /^[=+@]/.test(value);

/** Solo acepta nombres exactos del catálogo actual. No interpreta fórmulas ni IDs externos. */
export function parseRecipeImport(matrix: Cell[][], products: RecipeCatalogProduct[], items: RecipeStockItem[]): { groups: RecipeImportGroup[]; errors: string[] } {
  const headers = (matrix[0] ?? []).map(normalizeHeader);
  const required = ["producto", "insumo", "cantidad"] as const;
  const positions = required.map((name) => headers.indexOf(name));
  if (positions.some((position) => position < 0) || required.some((name) => headers.filter((header) => header === name).length !== 1)) {
    return { groups: [], errors: ["La primera fila debe contener exactamente una columna Producto, Insumo y Cantidad."] };
  }
  if (matrix.length > 201) return { groups: [], errors: ["Máximo 200 ingredientes por archivo. Divide la importación."] };
  const productByName = new Map(products.map((product) => [normalized(product.name), product]));
  const itemByName = new Map(items.map((item) => [normalized(item.name), item]));
  const groups = new Map<string, RecipeImportGroup>();
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const [index, cells] of matrix.slice(1).entries()) {
    if (cells.every((cell) => cell == null || String(cell).trim() === "")) continue;
    const productName = String(cells[positions[0]] ?? "").trim();
    const itemName = String(cells[positions[1]] ?? "").trim();
    const quantityText = String(cells[positions[2]] ?? "").trim().replace(",", ".");
    const quantity = Number(quantityText);
    const product = productByName.get(normalized(productName));
    const item = itemByName.get(normalized(itemName));
    const row = index + 2;
    if (!product || !item || unsafeName(productName) || unsafeName(itemName)
      || !/^\d+(?:\.\d{1,3})?$/.test(quantityText) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) {
      errors.push(`Fila ${row}: producto, insumo o cantidad inválidos. Usa los nombres exactos del catálogo y cantidades positivas con hasta tres decimales.`);
      continue;
    }
    const pair = `${product.id}:${item.id}`;
    if (seen.has(pair)) { errors.push(`Fila ${row}: el mismo insumo aparece dos veces para este producto.`); continue; }
    seen.add(pair);
    const group = groups.get(product.id) ?? { productId: product.id, productName: product.name, components: [] };
    group.components.push({ item_id: item.id, quantity });
    if (group.components.length > 30) errors.push(`Fila ${row}: máximo 30 insumos por producto.`);
    groups.set(product.id, group);
  }
  if (groups.size > 30) errors.push("Máximo 30 productos por archivo.");
  if (!groups.size && !errors.length) errors.push("El archivo no contiene recetas.");
  return { groups: errors.length ? [] : [...groups.values()], errors };
}
