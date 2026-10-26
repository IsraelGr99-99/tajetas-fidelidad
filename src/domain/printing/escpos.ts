/** Solo genera bytes ESC/POS genéricos. No abre USB/red/Bluetooth ni confirma compatibilidad. */
export type Ticket = {
  business: string;
  branch: string;
  folio: string;
  timestamp: string;
  lines: { name: string; quantity: number; totalCents: number }[];
  totalCents: number;
  payment: string;
};

function ascii(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "?");
}

function cents(value: number): string { return `$${(value / 100).toFixed(2)}`; }

export function buildEscPosTicket(ticket: Ticket, paper: "58mm" | "80mm" = "80mm"): Uint8Array {
  const width = paper === "58mm" ? 32 : 48;
  const encoder = new TextEncoder();
  const bytes: number[] = [0x1b, 0x40, 0x1b, 0x61, 0x01]; // init, center
  const line = (value: string) => { bytes.push(...encoder.encode(ascii(value).slice(0, width)), 0x0a); };
  line(ticket.business);
  line(ticket.branch);
  bytes.push(0x1b, 0x61, 0x00); // left
  line(`Folio: ${ticket.folio}`);
  line(ticket.timestamp);
  line("-".repeat(width));
  for (const item of ticket.lines) {
    line(`${item.quantity} x ${item.name}`);
    line(cents(item.totalCents).padStart(width));
  }
  line("-".repeat(width));
  line(`TOTAL ${cents(ticket.totalCents)}`);
  line(`Pago: ${ticket.payment}`);
  line("Gracias por tu compra");
  bytes.push(0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00); // feed, full cut
  return Uint8Array.from(bytes);
}
