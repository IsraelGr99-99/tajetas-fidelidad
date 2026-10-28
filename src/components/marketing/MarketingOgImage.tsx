import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function marketingOgImage(english: boolean) {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 70, position: "relative", overflow: "hidden", background: "#f9fcff", color: "#152337", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, fontWeight: 800 }}><span style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 15, background: "#3555ee", color: "#fff", fontSize: 40 }}>✳</span>Loyalty<span style={{ color: "#ef8d69", marginLeft: -14 }}>.</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 850 }}>
        <span style={{ color: "#3455d7", fontSize: 20, letterSpacing: 3, fontWeight: 800 }}>{english ? "MORE THAN A LOYALTY CARD" : "MÁS QUE UNA TARJETA DE FIDELIDAD"}</span>
        <span style={{ fontSize: 72, fontWeight: 900, letterSpacing: -4, lineHeight: 1.07 }}>{english ? "Make every visit count." : "Haz que cada visita cuente."}</span>
        <span style={{ color: "#50647a", fontSize: 26 }}>{english ? "Checkout · Inventory · Customers · Rewards" : "Caja · Inventario · Clientes · Recompensas"}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#385374", fontSize: 21 }}>Technology by <span style={{ fontWeight: 800 }}>iautomexa</span></div>
      <div style={{ position: "absolute", top: 130, right: -160, width: 430, height: 430, borderRadius: 215, background: "#c7efdf", opacity: .75 }} />
      <div style={{ position: "absolute", top: 220, right: -60, width: 260, height: 260, borderRadius: 130, background: "#a9c4ff", opacity: .72 }} />
    </div>,
    size,
  );
}
