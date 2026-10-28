import Image from "next/image";
import { formatMxn } from "@/lib/format";
import styles from "./ProductScreen.module.css";

type Locale = "es" | "en";
export type ScreenKind = "dashboard" | "caja" | "catalogo" | "calculadora" | "recetas" | "inventario";

/**
 * Capturas reales de la consola (empresas DEMO ficticias). Mientras falte una,
 * se muestra una recreación ilustrativa de la pantalla con datos de ejemplo.
 */
const SCREENSHOTS: Partial<Record<ScreenKind, string>> = {};

const paths: Record<ScreenKind, string> = {
  dashboard: "/negocio",
  caja: "/caja",
  catalogo: "/negocio/catalogo",
  calculadora: "/negocio/catalogo",
  recetas: "/negocio/catalogo",
  inventario: "/negocio/inventario",
};

const copy = {
  es: {
    sales: "Ventas", margin: "Margen", visits: "Visitas", week: "Últimos 7 días", branches: "Por sucursal",
    centro: "Sucursal Centro", cholula: "Sucursal Cholula", ticket: "Ticket", total: "Total", charge: "Registrar venta",
    search: "Buscar producto", products: "Productos", price: "Precio", cost: "Costo", target: "Margen objetivo",
    suggested: "Precio sugerido", supplies: "Insumos por unidad", stock: "Existencias", low: "Por agotarse", ok: "Suficiente",
    cone: "Cono doble", shake: "Malteada", cut: "Corte clásico", pomade: "Pomada mate",
    milk: "Leche entera", base: "Base de vainilla", cup: "Vaso 16 oz", waffle: "Cono de galleta",
  },
  en: {
    sales: "Sales", margin: "Margin", visits: "Visits", week: "Last 7 days", branches: "By location",
    centro: "Downtown location", cholula: "Cholula location", ticket: "Ticket", total: "Total", charge: "Record sale",
    search: "Search products", products: "Products", price: "Price", cost: "Cost", target: "Target margin",
    suggested: "Suggested price", supplies: "Supplies per unit", stock: "Stock", low: "Running low", ok: "In stock",
    cone: "Double cone", shake: "Milkshake", cut: "Classic cut", pomade: "Matte pomade",
    milk: "Whole milk", base: "Vanilla base", cup: "16 oz cup", waffle: "Waffle cone",
  },
} as const;

type Copy = (typeof copy)[Locale];

function Dashboard({ t }: { t: Copy }) {
  const bars = [42, 58, 51, 74, 66, 88, 79];
  return <div className={styles.dash}>
    <div className={styles.kpis}>
      <div><span>{t.sales}</span><strong>{formatMxn(4_862_000)}</strong><em>+12 %</em></div>
      <div><span>{t.margin}</span><strong>61 %</strong><em>+3 pts</em></div>
      <div><span>{t.visits}</span><strong>318</strong><em>+24</em></div>
    </div>
    <div className={styles.chartCard}>
      <span>{t.week}</span>
      <div className={styles.bars}>{bars.map((h, i) => <i key={i} data-grow style={{ height: `${h}%` }} />)}</div>
    </div>
    <div className={styles.branchCard}>
      <span>{t.branches}</span>
      <p><b>{t.centro}</b><i style={{ width: "78%" }} data-grow-x /></p>
      <p><b>{t.cholula}</b><i style={{ width: "54%" }} data-grow-x /></p>
    </div>
  </div>;
}

function Checkout({ t }: { t: Copy }) {
  const items = [
    { name: t.cone, price: 6_500, img: "/demo/icecream-cone.webp" },
    { name: t.shake, price: 8_900, img: "/demo/milkshake.webp" },
    { name: t.cut, price: 22_000, img: "/demo/barber-cut.webp" },
    { name: t.pomade, price: 18_500, img: "/demo/barber-pomade.webp" },
  ];
  return <div className={styles.checkout}>
    <div className={styles.tiles}>
      <div className={styles.search}>{t.search}</div>
      {items.map((item) => <div key={item.name} className={styles.tile}>
        <Image src={item.img} alt="" width={96} height={96} />
        <b>{item.name}</b><span>{formatMxn(item.price)}</span>
      </div>)}
    </div>
    <div className={styles.ticket}>
      <span>{t.ticket}</span>
      <p><b>2 × {t.cone}</b><span>{formatMxn(13_000)}</span></p>
      <p><b>1 × {t.shake}</b><span>{formatMxn(8_900)}</span></p>
      <p className={styles.total}><b>{t.total}</b><strong>{formatMxn(21_900)}</strong></p>
      <div className={styles.charge}>{t.charge}</div>
    </div>
  </div>;
}

function Catalog({ t }: { t: Copy }) {
  const rows = [
    { name: t.cone, price: 6_500, cost: 2_120, img: "/demo/icecream-cone.webp" },
    { name: t.shake, price: 8_900, cost: 3_310, img: "/demo/milkshake.webp" },
    { name: t.cut, price: 22_000, cost: 6_400, img: "/demo/barber-cut.webp" },
    { name: t.pomade, price: 18_500, cost: 9_100, img: "/demo/barber-pomade.webp" },
  ];
  return <div className={styles.table}>
    <p className={styles.tableHead}><span>{t.products}</span><span>{t.cost}</span><span>{t.price}</span></p>
    {rows.map((row) => <p key={row.name}>
      <span><Image src={row.img} alt="" width={64} height={64} /><b>{row.name}</b></span>
      <span>{formatMxn(row.cost)}</span><strong>{formatMxn(row.price)}</strong>
    </p>)}
  </div>;
}

function Calculator({ t }: { t: Copy }) {
  return <div className={styles.calc}>
    <div className={styles.calcInputs}>
      <p><span>{t.supplies}</span><b>{formatMxn(2_120)}</b></p>
      <p><span>{t.target}</span><b>60 %</b></p>
      <div className={styles.slider} aria-hidden="true"><i data-grow-x style={{ width: "60%" }} /></div>
    </div>
    <div className={styles.calcResult}>
      <span>{t.suggested}</span>
      <strong>{formatMxn(5_300)}</strong>
      <small>{t.cone}</small>
    </div>
  </div>;
}

function Recipes({ t }: { t: Copy }) {
  const supplies = [[t.base, "120 g"], [t.milk, "80 ml"], [t.waffle, "1 pza"], [t.cup, "—"]];
  return <div className={styles.recipe}>
    <div className={styles.recipeProduct}>
      <Image src="/demo/icecream-cone.webp" alt="" width={120} height={120} />
      <b>{t.cone}</b><span>{formatMxn(6_500)}</span>
    </div>
    <ul>{supplies.map(([name, qty]) => <li key={name}><span>{name}</span><b>{qty}</b></li>)}</ul>
  </div>;
}

function Inventory({ t }: { t: Copy }) {
  const rows = [
    { name: t.base, level: 72, low: false },
    { name: t.milk, level: 18, low: true },
    { name: t.waffle, level: 55, low: false },
    { name: t.cup, level: 34, low: false },
  ];
  return <div className={styles.inventory}>
    <p className={styles.tableHead}><span>{t.stock} · {t.centro}</span></p>
    {rows.map((row) => <p key={row.name}>
      <b>{row.name}</b>
      <span className={styles.level}><i data-grow-x style={{ width: `${row.level}%` }} className={row.low ? styles.levelLow : ""} /></span>
      <em className={row.low ? styles.badgeLow : styles.badgeOk}>{row.low ? t.low : t.ok}</em>
    </p>)}
  </div>;
}

/** Marco de navegador con la pantalla de un módulo de la consola. */
export function ProductScreen({ kind, locale, className = "", priority = false }: { kind: ScreenKind; locale: Locale; className?: string; priority?: boolean }) {
  const t = copy[locale];
  const shot = SCREENSHOTS[kind];
  return <div className={`${styles.window} ${className}`}>
    <div className={styles.chrome} aria-hidden="true">
      <span className={styles.dots}><i /><i /><i /></span>
      <span className={styles.url}>loyalty.iautomexa.com{paths[kind]}</span>
    </div>
    <div className={styles.body}>
      {shot ? <Image src={shot} alt="" fill sizes="(min-width: 1024px) 720px, 92vw" priority={priority} className={styles.shot} /> : <>
        {kind === "dashboard" && <Dashboard t={t} />}
        {kind === "caja" && <Checkout t={t} />}
        {kind === "catalogo" && <Catalog t={t} />}
        {kind === "calculadora" && <Calculator t={t} />}
        {kind === "recetas" && <Recipes t={t} />}
        {kind === "inventario" && <Inventory t={t} />}
      </>}
    </div>
  </div>;
}
