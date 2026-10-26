/**
 * Teléfono con un pase de fidelidad de ejemplo, como se ve en la cartera del
 * cliente. Es una ilustración: el negocio, los sellos y el código son ficticios
 * y van rotulados como ejemplo.
 */

// Patrón fijo con apariencia de QR (decorativo, no se puede escanear).
const QR_BITS = [
  "1111111010110111111", "1000001001010100001", "1011101011100101101", "1011101000110101101", "1011101010010101101",
  "1000001011100100001", "1111111010101111111", "0000000011010000000", "1101011100110110010", "0110100011001011101",
  "1011011101110010110", "0100100010011101001", "1110111001101011010", "0000000010110100101", "1111111011001011100",
  "1000001010110010011", "1011101001101101010", "1000001011010110101", "1111111010011010110",
];

function FakeQr() {
  const n = QR_BITS.length;
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="h-full w-full" shapeRendering="crispEdges" aria-hidden="true">
      {QR_BITS.flatMap((row, y) =>
        [...row].map((bit, x) => (bit === "1" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" /> : null)),
      )}
    </svg>
  );
}

export function WalletPhone({ className = "" }: { className?: string }) {
  const stamps = 8;
  const filled = 5;
  return (
    <figure aria-label="Ejemplo de pase de fidelidad en la cartera del teléfono" className={`relative ${className}`}>
      {/* Halo */}
      <div aria-hidden="true" className="absolute -inset-10 rounded-full bg-electrico/30 blur-3xl" />
      <div aria-hidden="true" className="absolute -right-6 bottom-10 h-40 w-40 rounded-full bg-cian/20 blur-3xl" />

      <div className="relative mx-auto w-[270px] rounded-[2.75rem] border border-white/15 bg-gradient-to-b from-[#1a2236] to-[#0a0f1c] p-2.5 shadow-[0_40px_80px_-30px_rgb(46_92_255/0.6)] sm:w-[300px]">
        <div className="relative overflow-hidden rounded-[2.2rem] bg-[#070b16] px-4 pb-6 pt-10">
          <span aria-hidden="true" className="absolute left-1/2 top-3 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
          <p className="text-[0.7rem] font-semibold text-niebla">Cartera</p>

          {/* El pase */}
          <div className="relative mt-3 overflow-hidden rounded-2xl bg-gradient-to-br from-electrico via-[#2347c9] to-marino p-4 text-white shadow-lg">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/15 to-transparent [animation:barrido_4.5s_ease-in-out_infinite]" />
            <div className="relative flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/15 text-xs">TN</span>
                Tu negocio
              </span>
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[0.65rem] font-semibold">Ejemplo</span>
            </div>
            <p className="relative mt-4 text-[0.7rem] text-white/80">Sellos</p>
            <p className="lx-dato relative text-2xl font-bold">
              {filled} <span className="text-base font-medium text-white/70">/ {stamps}</span>
            </p>
            <div className="relative mt-3 grid grid-cols-8 gap-1.5" aria-hidden="true">
              {Array.from({ length: stamps }, (_, i) => (
                <span
                  key={i}
                  className={`aspect-square rounded-full ${i < filled ? "bg-cian shadow-[0_0_10px_rgb(34_211_238/0.8)]" : "border border-white/35"}`}
                />
              ))}
            </div>
            <p className="relative mt-3 text-[0.7rem] text-white/85">Al sello 8, tu bebida va por la casa</p>
            <div className="relative mx-auto mt-4 h-28 w-28 rounded-xl bg-white p-2 text-marino">
              <FakeQr />
            </div>
          </div>

          <div className="mt-4 space-y-2" aria-hidden="true">
            <div className="h-10 rounded-xl bg-white/[0.05]" />
            <div className="h-10 rounded-xl bg-white/[0.03]" />
          </div>
        </div>
      </div>

      {/* Avisos flotantes */}
      <div
        aria-hidden="true"
        className="lx-panel absolute -left-1 top-32 flex items-center gap-2 whitespace-nowrap px-3 py-2 text-xs font-semibold [--giro:-4deg] [animation:flota_6s_ease-in-out_infinite] sm:-left-8"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-cian text-noche">+1</span>
        Sello registrado
      </div>
      <div
        aria-hidden="true"
        className="lx-panel absolute -right-1 bottom-24 flex items-center gap-2 whitespace-nowrap px-3 py-2 text-xs font-semibold [--giro:3deg] [animation:flota_7s_ease-in-out_1s_infinite] sm:-right-4"
      >
        <span className="h-2 w-2 rounded-full bg-cian [animation:pulso_2s_ease-in-out_infinite]" />
        Pase actualizado en Wallet
      </div>
    </figure>
  );
}
