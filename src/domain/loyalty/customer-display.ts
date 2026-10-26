/** PostgREST puede representar la relación uno-a-uno como objeto o arreglo. */
export function activeCustomerLabel(customer: unknown, serial: string): string {
  const record = Array.isArray(customer) ? customer[0] : customer;
  if (record && typeof record === "object" && "display_name" in record && typeof record.display_name === "string") {
    const name = record.display_name.trim();
    if (name) return name;
  }
  return `Tarjeta ${serial.slice(0, 8)}…`;
}
