/** Fotos locales para el catálogo del proyecto de demostración aislado. */
export function demoProductImage(businessId: string, productName: string): string | null {
  if (businessId === "10000000-0000-4000-8000-000000000001") {
    if (["Corte clásico", "Corte y barba", "Arreglo de barba"].includes(productName)) return "/demo/barber-cut.webp";
    if (["Cera modeladora · 50 g", "Pomada mate · 100 g"].includes(productName)) return "/demo/barber-pomade.webp";
  }
  if (businessId === "20000000-0000-4000-8000-000000000001") {
    if (["Helado · Sencillo", "Helado · Doble"].includes(productName)) return "/demo/icecream-cone.webp";
    if (["Malteada · Vainilla", "Malteada · Chocolate"].includes(productName)) return "/demo/milkshake.webp";
  }
  return null;
}
