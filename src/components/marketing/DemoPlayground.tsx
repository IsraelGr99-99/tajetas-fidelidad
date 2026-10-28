"use client";

import { useState } from "react";
import styles from "./DemoPlayground.module.css";

type Locale = "es" | "en";

export function DemoPlayground({ locale }: { locale: Locale }) {
  const [purchases, setPurchases] = useState(0);
  const visits = 4 + purchases;
  const remaining = 12 - purchases;
  const unlocked = visits >= 6;
  const t = locale === "es" ? {
    eyebrow: "02 / PRUÉBALO SIN REGISTRARTE",
    title: "Una compra mueve mucho más que un sello.",
    intro: "Toca el botón y mira cómo se conectan caja, inventario y fidelidad. Es una simulación local para conocer el producto: no cobra, no crea cuentas y no guarda datos.",
    badge: "DEMO INTERACTIVA · DATOS FICTICIOS",
    sale: "Caja",
    saleLabel: "Ventas de ejemplo",
    saleItem: "Helado artesanal",
    stock: "Inventario",
    stockLabel: "Porciones disponibles",
    loyalty: "Fidelidad",
    loyaltyLabel: "Visitas de ejemplo",
    earned: "Recompensa disponible en la simulación",
    pending: "Faltan visitas para la recompensa",
    button: "Simular una compra",
    reset: "Reiniciar demo",
    done: "Demo completa",
    helper: "Así se visualiza el flujo. En la operación real, el servidor confirma precios, existencias y reglas antes de registrar una venta.",
    status: "Compra simulada. Caja, inventario y fidelidad actualizados solo en esta pantalla.",
    features: ["Ventas por sucursal y empleado", "Alertas de insumos y recetas", "Clientes y tarjetas personalizables", "Panel de actividad y reportes"],
  } : {
    eyebrow: "02 / TRY IT WITHOUT SIGNING UP",
    title: "A purchase moves more than a stamp.",
    intro: "Tap the button to see how checkout, inventory, and loyalty connect. This local simulation helps you explore the product: it charges nothing, creates no account, and saves no data.",
    badge: "INTERACTIVE DEMO · SAMPLE DATA",
    sale: "Checkout",
    saleLabel: "Sample sales",
    saleItem: "Handmade ice cream",
    stock: "Inventory",
    stockLabel: "Servings available",
    loyalty: "Loyalty",
    loyaltyLabel: "Sample visits",
    earned: "Reward available in this simulation",
    pending: "More visits needed for a reward",
    button: "Simulate a purchase",
    reset: "Reset demo",
    done: "Demo complete",
    helper: "This is a visualization of the flow. In the real operation, the server confirms prices, stock, and rules before recording a sale.",
    status: "Purchase simulated. Checkout, inventory, and loyalty changed only on this screen.",
    features: ["Sales by branch and employee", "Ingredient and recipe alerts", "Customers and customizable cards", "Activity dashboard and reports"],
  };

  return (
    <section id="demo-interactiva" className={styles.section} aria-labelledby="demo-title">
      <div className={styles.wrap}>
        <div className={styles.intro}>
          <div><p className={styles.eyebrow}>{t.eyebrow}</p><h2 id="demo-title">{t.title}</h2></div>
          <p>{t.intro}</p>
        </div>
        <div className={styles.workspace}>
          <div className={styles.workspaceHead}><div><span className={styles.workspaceMark} aria-hidden="true">✳</span><strong>Loyalty</strong><span className={styles.workspaceSub}>{locale === "es" ? "Vista del negocio" : "Business view"}</span></div><span className={styles.badge}>{t.badge}</span></div>
          <div className={styles.flow}>
            <article className={styles.metric}><span className={styles.metricIcon} aria-hidden="true">↗</span><p>{t.sale}</p><h3>{t.saleLabel}</h3><strong>{1 + purchases}</strong><small>{t.saleItem} · $58 MXN</small></article>
            <span className={styles.connector} aria-hidden="true">→</span>
            <article className={styles.metric}><span className={styles.metricIcon} aria-hidden="true">◈</span><p>{t.stock}</p><h3>{t.stockLabel}</h3><strong>{remaining}</strong><small>{locale === "es" ? "Sucursal de ejemplo" : "Sample branch"}</small></article>
            <span className={styles.connector} aria-hidden="true">→</span>
            <article className={`${styles.metric} ${styles.loyalty}`}><span className={styles.metricIcon} aria-hidden="true">✳</span><p>{t.loyalty}</p><h3>{t.loyaltyLabel}</h3><strong>{visits}<span> / 6</span></strong><small>{unlocked ? t.earned : t.pending}</small></article>
          </div>
          <div className={styles.demoControls}>
            <button type="button" onClick={() => setPurchases((n) => Math.min(4, n + 1))} disabled={purchases >= 4} className={styles.simulate}>{purchases >= 4 ? t.done : t.button} <span aria-hidden="true">↗</span></button>
            <button type="button" onClick={() => setPurchases(0)} className={styles.reset} disabled={purchases === 0}>{t.reset}</button>
            <span role="status" className={styles.status}>{purchases ? t.status : t.helper}</span>
          </div>
        </div>
        <div className={styles.beyond}><p>{locale === "es" ? "Y detrás de la tarjeta, un negocio mejor conectado:" : "And behind the card, a better connected business:"}</p><ul>{t.features.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul></div>
      </div>
    </section>
  );
}
