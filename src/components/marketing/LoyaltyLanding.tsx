import { Fragment } from "react";
import Link from "next/link";
import { formatMxn } from "@/lib/format";
import { CardShowcase } from "./CardShowcase";
import { MarketingMotion } from "./MarketingMotion";
import { ProductScreen, type ScreenKind } from "./ProductScreen";
import styles from "./LoyaltyLanding.module.css";

type Locale = "es" | "en";

const CONTACT = "https://iautomexa.com/contacto/";

const sectionIds = ["sistema", "funciones", "aplicaciones", "wallet", "preguntas"] as const;

const content = {
  es: {
    nav: ["Sistema", "Funciones", "Tarjetas", "Wallet", "Preguntas"],
    cta: "Solicitar demo guiada",
    explore: "Explorar el sistema",
    brandLine: "Una tecnología de",
    menu: "Menú",
    lang: "English",
    langLabel: "View in English",
    mainNav: "Navegación principal",
    mobileNav: "Navegación móvil",
    eyebrow: "Loyalty · Sistema para negocios",
    headline: ["Mucho", "más", "que", "lealtad."],
    headlineEm: ["Todo", "tu", "negocio,", "conectado."],
    lead: "Caja, productos, inventario, recetas, reportes y un programa de fidelidad que tus clientes guardan en su teléfono. Un solo sistema para una o muchas sucursales, con cada persona en su rol.",
    heroFigure: "Vista ilustrativa del panel y de la tarjeta digital",
    heroCaption: "Vista ilustrativa · empresas y datos de ejemplo",
    chips: ["Venta registrada", "+1 visita en la tarjeta", "Inventario actualizado"],
    passBusiness: "Brisa Helados",
    passLabel: "Tarjeta de visitas",
    passProgress: "5 de 8 visitas",
    passReward: "Un helado de regalo en la visita 8",
    modulesLabel: "Módulos de Loyalty",
    modules: ["Caja", "Productos", "Calculadora de precios", "Recetas", "Inventario", "Reportes", "Dashboards", "Multiempresa", "Sucursales", "Roles de usuario", "Programa de fidelidad", "Wallet"],
    systemEyebrow: "El sistema detrás de la tarjeta",
    systemTitle: <>La tarjeta es lo que ve tu cliente.{" "}<em>Detrás está todo lo que necesitas para operar.</em></>,
    systemIntro: "Loyalty no es solo un programa de puntos: es la herramienta con la que tu equipo vende, controla existencias y entiende el negocio día a día.",
    systemSteps: [
      { kind: "caja", title: "Caja", text: "Registra ventas desde una pantalla pensada para el mostrador: buscas el producto, confirmas y listo. Si el cliente muestra su tarjeta, también suma su visita." },
      { kind: "catalogo", title: "Productos", text: "Organiza tu catálogo con fotos, variantes, costos y precios, listo para usarse en caja en todas tus sucursales." },
      { kind: "calculadora", title: "Calculadora de precios", text: "Desglosa lo que cuesta preparar cada producto y fija el margen que quieres ganar. Loyalty te sugiere el precio mínimo." },
      { kind: "recetas", title: "Recetas", text: "Asocia insumos a cada producto. Cuando vendes, el sistema descuenta de tu inventario exactamente lo que se usó." },
      { kind: "inventario", title: "Inventario por sucursal", text: "Consulta existencias de cada sucursal, registra entradas y detecta a tiempo lo que está por agotarse." },
      { kind: "dashboard", title: "Reportes y dashboards", text: "Ventas, costos, gastos y visitas por sucursal y por periodo, en un panel claro para decidir con datos." },
    ] as { kind: ScreenKind; title: string; text: string }[],
    systemNote: "Pantallas ilustrativas con empresas ficticias.",
    featuresEyebrow: "Todo en un solo lugar",
    featuresTitle: <>Una plataforma.{" "}<em>Todas las piezas de tu operación.</em></>,
    multiTitle: "Multiempresa y multisucursal",
    multiText: "Administra varias empresas y sus sucursales desde una sola cuenta. La información de cada empresa queda separada.",
    multiOrg: "Tu cuenta",
    multiCompanies: [["Norte Barber Studio", ["Centro", "Cholula"]], ["Brisa Helados", ["Centro", "Cholula"]]] as [string, string[]][],
    rolesTitle: "Roles de usuario",
    rolesText: "Cada persona entra con su propio acceso y solo ve lo que su rol permite.",
    roles: ["Propietario", "Administración", "Gerencia", "Mostrador"],
    loyaltyTitle: "Fidelidad a tu medida",
    loyaltyText: "Tú defines cuántas visitas se necesitan y qué recompensa entregas.",
    loyaltyGoal: "8 visitas",
    loyaltyReward: "1 recompensa",
    dashTitle: "Reportes que se entienden",
    dashText: "Ventas, margen y visitas por sucursal, sin hojas de cálculo.",
    calcTitle: "Precio justo, margen claro",
    calcText: "Del costo al precio sugerido en segundos.",
    calcCost: "Costo",
    calcPrice: "Precio",
    checkoutTitle: "Caja ágil",
    checkoutText: "Pensada para el ritmo real del mostrador.",
    recipesTitle: "Recetas conectadas",
    recipesText: "Cada venta descuenta sus insumos.",
    walletTileTitle: "En la cartera del teléfono",
    walletTileText: "Tus clientes guardan su tarjeta y la ven actualizada con cada visita.",
    walletTileLink: "Ver cómo funciona",
    flowEyebrow: "Un flujo, no herramientas aisladas",
    flowTitle: <>Una venta{" "}<em>mueve todo tu negocio.</em></>,
    flow: [
      { title: "Vendes en caja", text: "Tu equipo registra la venta en su sucursal." },
      { title: "El inventario se ajusta", text: "La receta indica qué insumos se usaron." },
      { title: "Tu cliente suma una visita", text: "Su tarjeta digital avanza hacia la recompensa." },
      { title: "El reporte se actualiza", text: "Ventas, costos y visitas llegan a tu panel." },
    ],
    flowNote: "En la operación real, el servidor confirma precios, existencias y reglas antes de registrar cada venta.",
    walletEyebrow: "En el teléfono de tu cliente",
    walletTitle: <>Sin apps que descargar.{" "}<em>Su tarjeta, siempre a la mano.</em></>,
    walletText: "Tus clientes se registran con un código QR, abren su tarjeta en el navegador y pueden guardarla en la cartera de su teléfono. Se actualiza sola con cada visita.",
    walletPoints: ["Registro con QR, sin descargar nada", "Progreso y recompensa siempre visibles", "Para sumar visitas, muestran el QR de su tarjeta"],
    walletGoogle: "Google Wallet",
    walletGoogleStatus: "Disponible",
    walletApple: "Apple Wallet",
    walletAppleStatus: "Próximamente",
    walletNote: "Google Wallet requiere configurarse para cada negocio.",
    walletFigure: "Ilustración de una tarjeta guardada en la cartera del teléfono",
    trustEyebrow: "Hecho por iautomexa",
    trustTitle: <>Sencillo por fuera.{" "}<em>Sólido por dentro.</em></>,
    trust: [
      ["Reglas en el servidor", "Visitas, recompensas y canjes los decide el sistema, nunca el navegador."],
      ["Historial auditable", "Cada movimiento queda registrado; las correcciones se hacen con un ajuste y su motivo."],
      ["Empresas separadas", "Cada negocio ve únicamente su propia información."],
      ["Sin app para tus clientes", "Todo funciona desde el navegador del teléfono."],
    ],
    trustLink: "Conoce iautomexa",
    faqEyebrow: "Preguntas frecuentes",
    faqTitle: <>Todo claro{" "}<em>desde el inicio.</em></>,
    faqs: [
      ["¿Mis clientes tienen que descargar una app?", "No. Abren su tarjeta en el navegador y pueden guardarla en Google Wallet cuando el negocio lo tiene configurado. Apple Wallet llegará próximamente."],
      ["¿Funciona con varias sucursales o empresas?", "Sí. Puedes operar varias empresas y sucursales; cada sucursal tiene su inventario, su equipo y sus reportes."],
      ["¿Qué incluye además de la tarjeta?", "Caja, productos y variantes, calculadora de precios, recetas, inventario por sucursal, reportes, roles de usuario y programa de fidelidad. El cobro con tarjeta integrado y la impresión de tickets todavía están en desarrollo."],
      ["¿Puedo limitar lo que hace mi equipo?", "Sí. Cada persona entra con su propio acceso y su rol define qué puede hacer; por ejemplo, el personal de mostrador registra visitas y canjes, y gerencia además puede revertir movimientos."],
      ["¿Cómo lo pruebo?", "Solicita una demo guiada: te mostramos el sistema funcionando con empresas de ejemplo y datos ficticios, y resolvemos tus dudas."],
    ],
    finalEyebrow: "Tu siguiente visita empieza aquí",
    finalTitle: <>Hagamos que quieran{" "}<em>volver.</em></>,
    finalText: "Cuéntanos qué vendes y cuántas sucursales tienes. Te mostramos Loyalty funcionando con datos de ejemplo y lo que viene después.",
    footerTitle: "Cada visita puede ser el comienzo de algo más.",
    footer: "Fidelidad y operación para negocios que crecen con sus clientes.",
    footerExplore: "Explora",
    footerCompany: "Compañía",
  },
  en: {
    nav: ["System", "Features", "Cards", "Wallet", "FAQ"],
    cta: "Request a guided demo",
    explore: "Explore the system",
    brandLine: "Technology by",
    menu: "Menu",
    lang: "Español",
    langLabel: "Ver en español",
    mainNav: "Main navigation",
    mobileNav: "Mobile navigation",
    eyebrow: "Loyalty · A system for businesses",
    headline: ["Much", "more", "than", "loyalty."],
    headlineEm: ["Your", "whole", "business,", "connected."],
    lead: "Checkout, products, inventory, recipes, reports, and a loyalty program your customers keep on their phone. One system for one or many locations, with everyone in the right role.",
    heroFigure: "Illustrative view of the dashboard and the digital card",
    heroCaption: "Illustrative view · sample businesses and data",
    chips: ["Sale recorded", "+1 visit on the card", "Inventory updated"],
    passBusiness: "Brisa Helados",
    passLabel: "Visit card",
    passProgress: "5 of 8 visits",
    passReward: "A free ice cream on visit 8",
    modulesLabel: "Loyalty modules",
    modules: ["Checkout", "Products", "Price calculator", "Recipes", "Inventory", "Reports", "Dashboards", "Multi-business", "Locations", "User roles", "Loyalty program", "Wallet"],
    systemEyebrow: "The system behind the card",
    systemTitle: <>The card is what customers see.{" "}<em>Behind it is everything you need to run your business.</em></>,
    systemIntro: "Loyalty is more than a points program: it is the tool your team uses to sell, track stock, and understand the business every day.",
    systemSteps: [
      { kind: "caja", title: "Checkout", text: "Record sales from a screen built for the counter: find the product, confirm, done. If the customer shows their card, the visit counts too." },
      { kind: "catalogo", title: "Products", text: "Organize your catalog with photos, variants, costs, and prices, ready for checkout at every location." },
      { kind: "calculadora", title: "Price calculator", text: "Break down what each product costs to make and set the margin you want. Loyalty suggests the minimum price." },
      { kind: "recetas", title: "Recipes", text: "Link supplies to each product. When you sell, the system deducts exactly what was used from inventory." },
      { kind: "inventario", title: "Inventory by location", text: "Check stock at each location, record deliveries, and catch what is running low in time." },
      { kind: "dashboard", title: "Reports and dashboards", text: "Sales, costs, expenses, and visits by location and period, in a clear dashboard for data-driven decisions." },
    ] as { kind: ScreenKind; title: string; text: string }[],
    systemNote: "Illustrative screens with fictitious businesses.",
    featuresEyebrow: "Everything in one place",
    featuresTitle: <>One platform.{" "}<em>Every piece of your operation.</em></>,
    multiTitle: "Multi-business, multi-location",
    multiText: "Manage several businesses and their locations from one account. Each business keeps its data separate.",
    multiOrg: "Your account",
    multiCompanies: [["Norte Barber Studio", ["Downtown", "Cholula"]], ["Brisa Helados", ["Downtown", "Cholula"]]] as [string, string[]][],
    rolesTitle: "User roles",
    rolesText: "Everyone signs in with their own access and only sees what their role allows.",
    roles: ["Owner", "Admin", "Manager", "Counter staff"],
    loyaltyTitle: "Loyalty your way",
    loyaltyText: "You decide how many visits it takes and what reward you give.",
    loyaltyGoal: "8 visits",
    loyaltyReward: "1 reward",
    dashTitle: "Reports that make sense",
    dashText: "Sales, margin, and visits by location, no spreadsheets.",
    calcTitle: "Fair price, clear margin",
    calcText: "From cost to suggested price in seconds.",
    calcCost: "Cost",
    calcPrice: "Price",
    checkoutTitle: "Fast checkout",
    checkoutText: "Built for the real pace of the counter.",
    recipesTitle: "Connected recipes",
    recipesText: "Every sale deducts its supplies.",
    walletTileTitle: "In the phone wallet",
    walletTileText: "Customers save their card and see it update with every visit.",
    walletTileLink: "See how it works",
    flowEyebrow: "One workflow, not disconnected tools",
    flowTitle: <>One sale{" "}<em>moves your whole business.</em></>,
    flow: [
      { title: "You sell at checkout", text: "Your team records the sale at its location." },
      { title: "Inventory adjusts", text: "The recipe tells which supplies were used." },
      { title: "Your customer earns a visit", text: "Their digital card moves toward the reward." },
      { title: "Reports update", text: "Sales, costs, and visits reach your dashboard." },
    ],
    flowNote: "In real operation, the server confirms prices, stock, and rules before recording each sale.",
    walletEyebrow: "On your customer's phone",
    walletTitle: <>No apps to download.{" "}<em>Their card, always at hand.</em></>,
    walletText: "Customers sign up with a QR code, open their card in the browser, and can save it to their phone wallet. It updates on its own with every visit.",
    walletPoints: ["QR sign-up, nothing to download", "Progress and reward always visible", "To earn visits, they show their card's QR code"],
    walletGoogle: "Google Wallet",
    walletGoogleStatus: "Available",
    walletApple: "Apple Wallet",
    walletAppleStatus: "Coming soon",
    walletNote: "Google Wallet must be configured for each business.",
    walletFigure: "Illustration of a card saved in a phone wallet",
    trustEyebrow: "Built by iautomexa",
    trustTitle: <>Simple outside.{" "}<em>Solid inside.</em></>,
    trust: [
      ["Server-side rules", "Visits, rewards, and redemptions are decided by the system, never the browser."],
      ["Auditable history", "Every movement is recorded; corrections are made with an adjustment and a reason."],
      ["Separate businesses", "Each business only sees its own information."],
      ["No app for customers", "Everything works from the phone's browser."],
    ],
    trustLink: "Discover iautomexa",
    faqEyebrow: "Frequently asked",
    faqTitle: <>Clear from{" "}<em>day one.</em></>,
    faqs: [
      ["Do my customers need to download an app?", "No. They open their card in the browser and can save it to Google Wallet when the business has it configured. Apple Wallet is coming soon."],
      ["Does it work with multiple locations or businesses?", "Yes. You can run several businesses and locations; each location has its own inventory, team, and reports."],
      ["What is included beyond the card?", "Checkout, products and variants, a price calculator, recipes, inventory by location, reports, user roles, and a loyalty program. Integrated card payments and ticket printing are still in development."],
      ["Can I limit what my team can do?", "Yes. Everyone signs in with their own access and their role defines what they can do; for example, counter staff record visits and redemptions, and managers can also reverse movements."],
      ["How can I try it?", "Request a guided demo: we will show you the system running with sample businesses and fictitious data, and answer your questions."],
    ],
    finalEyebrow: "Your next visit starts here",
    finalTitle: <>Give them a reason{" "}<em>to return.</em></>,
    finalText: "Tell us what you sell and how many locations you have. We will show you Loyalty running with sample data and what is coming next.",
    footerTitle: "Every visit can be the start of something more.",
    footerExplore: "Explore",
    footerCompany: "Company",
    footer: "Loyalty and operations for businesses growing with their customers.",
  },
} as const;

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true" className={styles.arrow}>{diagonal ? "↗" : "→"}</span>;
}

function Mark() {
  return <span className={styles.logoMark} aria-hidden="true">✳</span>;
}

function Icon({ name }: { name: "check" | "spark" | "qr" | "layers" | "shield" | "lock" | "phone" | "history" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg viewBox="0 0 24 24" aria-hidden="true" {...common}>
    {name === "check" && <path d="m5 12.5 4.5 4.5L19 7.5" />}
    {name === "spark" && <path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" />}
    {name === "qr" && <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v7h-6" /></>}
    {name === "layers" && <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>}
    {name === "shield" && <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" />}
    {name === "lock" && <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>}
    {name === "phone" && <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></>}
    {name === "history" && <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>}
  </svg>;
}

function PassCard({ business, label, progress, reward, filled, goal, className = "" }: { business: string; label: string; progress: string; reward: string; filled: number; goal: number; className?: string }) {
  return <div className={`${styles.pass} ${className}`}>
    <div className={styles.passTop}><span className={styles.passMark} aria-hidden="true">✳</span><span>{business}</span></div>
    <span className={styles.passLabel}>{label}</span>
    <strong>{progress}</strong>
    <div className={styles.passStamps} aria-hidden="true">{Array.from({ length: goal }, (_, i) => <i key={i} data-stamp className={i < filled ? styles.stampOn : ""} />)}</div>
    <p>{reward}</p>
    <div className={styles.passQr} aria-hidden="true" />
  </div>;
}

export function LoyaltyLanding({ locale }: { locale: Locale }) {
  const t = content[locale];
  const home = locale === "es" ? "/" : "/en";
  const otherLocale = locale === "es" ? "/en" : "/";
  const otherHrefLang = locale === "es" ? "en" : "es-MX";

  return <MarketingMotion className={styles.site}>
    <header data-header className={styles.header}>
      <div className={styles.wrap}>
        <Link href={home} className={styles.logo} aria-label="Loyalty by iautomexa"><Mark /><span>Loyalty<span className={styles.logoDot}>.</span></span></Link>
        <nav className={styles.desktopNav} aria-label={t.mainNav}>
          {t.nav.map((label, index) => <a data-section-link href={`#${sectionIds[index]}`} key={label}>{label}</a>)}
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.language} href={otherLocale} hrefLang={otherHrefLang} aria-label={t.langLabel}>{t.lang}</Link>
          <a className={`${styles.button} ${styles.buttonPrimary} ${styles.headerCta}`} href={CONTACT}>{t.cta} <Arrow diagonal /></a>
          <details data-mobile-menu className={styles.mobileMenu}>
            <summary>{t.menu} <span aria-hidden="true">☰</span></summary>
            <nav aria-label={t.mobileNav}>
              {t.nav.map((label, index) => <a data-section-link href={`#${sectionIds[index]}`} key={label}>{label}</a>)}
              <a href={CONTACT} className={styles.mobileCta}>{t.cta} <Arrow diagonal /></a>
            </nav>
          </details>
        </div>
      </div>
    </header>

    <main id="contenido">
      {/* Portada */}
      <section data-motion-hero className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.aurora} aria-hidden="true"><i data-aurora /><i data-aurora /><i data-aurora /></div>
        <div className={`${styles.wrap} ${styles.heroInner}`}>
          <a data-hero-fade className={styles.brandPill} href="https://iautomexa.com/"><span className={styles.pillSpark} aria-hidden="true">✳</span>{t.brandLine} <strong>iautomexa</strong><Arrow diagonal /></a>
          <p data-hero-fade className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 id="hero-title" className={styles.heroTitle}>
            <span className={styles.line}>{t.headline.map((word, i) => <Fragment key={i}><span className={styles.word}><span data-word>{word}</span></span>{" "}</Fragment>)}</span>
            <em className={styles.line}>{t.headlineEm.map((word, i) => <Fragment key={i}><span className={styles.word}><span data-word>{word}</span></span>{" "}</Fragment>)}</em>
          </h1>
          <p data-hero-fade className={styles.lead}>{t.lead}</p>
          <div data-hero-fade className={styles.heroActions}>
            <a className={`${styles.button} ${styles.buttonPrimary} ${styles.buttonLarge}`} href={CONTACT}>{t.cta} <Arrow diagonal /></a>
            <a className={`${styles.button} ${styles.buttonGhost} ${styles.buttonLarge}`} href="#sistema">{t.explore} <Arrow /></a>
          </div>
        </div>
        <figure data-hero-stage className={styles.heroStage} aria-label={t.heroFigure}>
          <div data-hero-device className={styles.heroLaptop}>
            <ProductScreen kind="dashboard" locale={locale} priority />
          </div>
          <div data-hero-phone className={styles.heroPhone}>
            <div className={styles.phoneScreen}>
              <PassCard business={t.passBusiness} label={t.passLabel} progress={t.passProgress} reward={t.passReward} filled={5} goal={8} />
            </div>
          </div>
          <ul className={styles.chips} aria-hidden="true">
            {t.chips.map((chip, i) => <li key={chip} data-chip className={styles[`chip${i + 1}` as "chip1"]}><Icon name="check" />{chip}</li>)}
          </ul>
          <figcaption>{t.heroCaption}</figcaption>
        </figure>
        <div className={styles.marquee} aria-label={t.modulesLabel} role="region">
          <ul data-marquee className={styles.marqueeTrack}>
            {[...t.modules, ...t.modules].map((module, i) => <li key={i} aria-hidden={i >= t.modules.length || undefined}><Icon name="spark" />{module}</li>)}
          </ul>
        </div>
      </section>

      {/* Recorrido por el sistema */}
      <section id="sistema" data-tour className={styles.system} aria-labelledby="system-title">
        <div className={styles.wrap}>
          <header data-reveal className={styles.sectionHead}>
            <p className={styles.eyebrow}>{t.systemEyebrow}</p>
            <h2 id="system-title">{t.systemTitle}</h2>
            <p>{t.systemIntro}</p>
          </header>
          <div data-tour-stage className={styles.tour}>
            <ol className={styles.tourSteps}>
              {t.systemSteps.map((step, i) => <li key={step.kind} data-tour-step data-active={i === 0 ? "true" : undefined} className={styles.tourStep}>
                <span className={styles.tourIndex}>{String(i + 1).padStart(2, "0")}</span>
                <div className={styles.tourCopy}><h3>{step.title}</h3><p>{step.text}</p></div>
                <div data-tour-screen className={styles.tourScreen}><ProductScreen kind={step.kind} locale={locale} /></div>
              </li>)}
            </ol>
            <div className={styles.tourProgress} aria-hidden="true"><i data-tour-bar /></div>
          </div>
          <p className={styles.note}>{t.systemNote}</p>
        </div>
      </section>

      {/* Funciones */}
      <section id="funciones" className={styles.features} aria-labelledby="features-title">
        <div className={styles.wrap}>
          <header data-reveal className={styles.sectionHead}>
            <p className={styles.eyebrow}>{t.featuresEyebrow}</p>
            <h2 id="features-title">{t.featuresTitle}</h2>
          </header>
          <div className={styles.bento}>
            <article data-reveal className={`${styles.tile} ${styles.tileWide} ${styles.tileMulti}`}>
              <div className={styles.tileCopy}><span className={styles.tileIcon}><Icon name="layers" /></span><h3>{t.multiTitle}</h3><p>{t.multiText}</p></div>
              <div className={styles.orgTree} aria-hidden="true">
                <span className={styles.orgRoot}>✳ {t.multiOrg}</span>
                <div className={styles.orgCompanies}>
                  {t.multiCompanies.map(([company, branches]) => <div key={company} className={styles.orgCompany}>
                    <b>{company}</b>
                    {branches.map((branch) => <span key={branch}>{branch}</span>)}
                  </div>)}
                </div>
              </div>
            </article>
            <article data-reveal className={`${styles.tile} ${styles.tileTall} ${styles.tileLoyalty}`}>
              <div className={styles.tileCopy}><span className={styles.tileIcon}><Icon name="spark" /></span><h3>{t.loyaltyTitle}</h3><p>{t.loyaltyText}</p></div>
              <div className={styles.loyaltyVisual} aria-hidden="true">
                <div className={styles.stampGrid}>{Array.from({ length: 8 }, (_, i) => <i key={i} data-stamp className={i < 6 ? styles.stampOn : ""}>{i < 6 ? "✳" : ""}</i>)}</div>
                <div className={styles.ruleRow}><span>{t.loyaltyGoal}</span><span>→</span><span>{t.loyaltyReward}</span></div>
              </div>
            </article>
            <article data-reveal className={`${styles.tile} ${styles.tileRoles}`}>
              <div className={styles.tileCopy}><span className={styles.tileIcon}><Icon name="lock" /></span><h3>{t.rolesTitle}</h3><p>{t.rolesText}</p></div>
              <ul className={styles.roleChips} aria-label={t.rolesTitle}>{t.roles.map((role) => <li key={role}>{role}</li>)}</ul>
            </article>
            <article data-reveal className={`${styles.tile} ${styles.tileWide} ${styles.tileDash}`}>
              <div className={styles.tileCopy}><span className={styles.tileIcon}><Icon name="history" /></span><h3>{t.dashTitle}</h3><p>{t.dashText}</p></div>
              <div className={styles.miniChart} aria-hidden="true">{[38, 52, 46, 64, 58, 76, 70, 88, 82, 95].map((h, i) => <i key={i} data-grow style={{ height: `${h}%` }} />)}</div>
            </article>
            <article data-reveal className={`${styles.tile} ${styles.tileCalc}`}>
              <div className={styles.tileCopy}><h3>{t.calcTitle}</h3><p>{t.calcText}</p></div>
              <div className={styles.calcVisual} aria-hidden="true"><span>{t.calcCost}<b>{formatMxn(2_120)}</b></span><span className={styles.calcArrow}>→</span><span>{t.calcPrice}<b>{formatMxn(5_300)}</b></span></div>
            </article>
            <article data-reveal className={`${styles.tile} ${styles.tileCheckout}`}>
              <div className={styles.tileCopy}><span className={styles.tileIcon}><Icon name="qr" /></span><h3>{t.checkoutTitle}</h3><p>{t.checkoutText}</p></div>
            </article>
            <article data-reveal className={`${styles.tile} ${styles.tileRecipes}`}>
              <div className={styles.tileCopy}><span className={styles.tileIcon}><Icon name="layers" /></span><h3>{t.recipesTitle}</h3><p>{t.recipesText}</p></div>
            </article>
            <article data-reveal className={`${styles.tile} ${styles.tileWide} ${styles.tileWallet}`}>
              <div className={styles.tileCopy}><span className={styles.tileIcon}><Icon name="phone" /></span><h3>{t.walletTileTitle}</h3><p>{t.walletTileText}</p><a href="#wallet" className={styles.tileLink}>{t.walletTileLink} <Arrow /></a></div>
              <div className={styles.miniPasses} aria-hidden="true"><i /><i /><i /></div>
            </article>
          </div>
        </div>
      </section>

      {/* Flujo conectado */}
      <section data-flow className={styles.flow} aria-labelledby="flow-title">
        <div className={styles.wrap}>
          <header data-reveal className={`${styles.sectionHead} ${styles.centered}`}>
            <p className={styles.eyebrow}>{t.flowEyebrow}</p>
            <h2 id="flow-title">{t.flowTitle}</h2>
          </header>
          <div className={styles.flowTrack}>
            <svg className={styles.flowLine} viewBox="0 0 1000 40" preserveAspectRatio="none" aria-hidden="true">
              <path className={styles.flowLineBase} d="M20 20 H980" />
              <path data-flow-path className={styles.flowLineDraw} d="M20 20 H980" />
            </svg>
            <ol className={styles.flowNodes}>
              {t.flow.map((node, i) => <li key={node.title} data-flow-node>
                <span className={styles.flowDot}>{String(i + 1).padStart(2, "0")}</span>
                <h3>{node.title}</h3><p>{node.text}</p>
              </li>)}
            </ol>
          </div>
          <p className={`${styles.note} ${styles.centeredNote}`}>{t.flowNote}</p>
        </div>
      </section>

      <CardShowcase locale={locale} />

      {/* Wallet */}
      <section id="wallet" data-wallet className={styles.wallet} aria-labelledby="wallet-title">
        <div className={`${styles.wrap} ${styles.walletLayout}`}>
          <div data-reveal className={styles.walletCopy}>
            <p className={styles.eyebrow}>{t.walletEyebrow}</p>
            <h2 id="wallet-title">{t.walletTitle}</h2>
            <p className={styles.walletText}>{t.walletText}</p>
            <ul className={styles.walletPoints}>{t.walletPoints.map((point) => <li key={point}><Icon name="check" />{point}</li>)}</ul>
            <div className={styles.walletBadges}>
              <span className={styles.walletBadge}><b>{t.walletGoogle}</b><em className={styles.statusOn}>{t.walletGoogleStatus}</em></span>
              <span className={styles.walletBadge}><b>{t.walletApple}</b><em className={styles.statusSoon}>{t.walletAppleStatus}</em></span>
            </div>
            <p className={styles.note}>{t.walletNote}</p>
          </div>
          <figure className={styles.walletStage} aria-label={t.walletFigure}>
            <div className={styles.walletPhone}>
              <div className={styles.walletScreen}>
                <span className={styles.walletHeader}>Wallet</span>
                <div className={styles.walletStack} aria-hidden="true"><i /><i /></div>
                <div data-wallet-pass className={styles.walletPass}>
                  <PassCard business="Norte Barber Studio" label={t.passLabel} progress={locale === "es" ? "4 de 6 visitas" : "4 of 6 visits"} reward={locale === "es" ? "Corte de cortesía en la visita 6" : "A complimentary cut on visit 6"} filled={4} goal={6} className={styles.passDark} />
                </div>
              </div>
            </div>
          </figure>
        </div>
      </section>

      {/* Confianza */}
      <section className={styles.trust} aria-labelledby="trust-title">
        <div className={`${styles.wrap} ${styles.trustLayout}`}>
          <header data-reveal className={styles.sectionHead}>
            <p className={styles.eyebrow}>{t.trustEyebrow}</p>
            <h2 id="trust-title">{t.trustTitle}</h2>
            <a href="https://iautomexa.com/" className={styles.tileLink}>{t.trustLink} <Arrow diagonal /></a>
          </header>
          <ul className={styles.trustGrid}>
            {t.trust.map(([title, text], i) => <li data-reveal key={title}><span className={styles.tileIcon}><Icon name={(["shield", "history", "lock", "phone"] as const)[i]} /></span><h3>{title}</h3><p>{text}</p></li>)}
          </ul>
        </div>
      </section>

      {/* Preguntas */}
      <section id="preguntas" className={styles.faq} aria-labelledby="faq-title">
        <div className={`${styles.wrap} ${styles.faqLayout}`}>
          <header data-reveal className={styles.sectionHead}>
            <p className={styles.eyebrow}>{t.faqEyebrow}</p>
            <h2 id="faq-title">{t.faqTitle}</h2>
          </header>
          <div className={styles.faqItems}>{t.faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
        </div>
      </section>

      {/* Cierre */}
      <section className={styles.final} aria-labelledby="final-title">
        <div className={styles.aurora} aria-hidden="true"><i data-aurora /><i data-aurora /><i data-aurora /></div>
        <div data-reveal className={`${styles.wrap} ${styles.finalInner}`}>
          <p className={styles.eyebrow}>{t.finalEyebrow}</p>
          <h2 id="final-title">{t.finalTitle}</h2>
          <p>{t.finalText}</p>
          <div className={styles.finalActions}>
            <a href={CONTACT} className={`${styles.button} ${styles.buttonLight} ${styles.buttonLarge}`}>{t.cta} <Arrow diagonal /></a>
            <a href="#sistema" className={`${styles.button} ${styles.buttonGhostDark} ${styles.buttonLarge}`}>{t.explore} <Arrow /></a>
          </div>
        </div>
      </section>
    </main>

    <footer className={styles.footer}>
      <div className={styles.wrap}>
        <div className={styles.footerMain}>
          <div className={styles.footerBrand}><span className={styles.logo}><Mark /><span>Loyalty<span className={styles.logoDot}>.</span></span></span><p>{t.footerTitle}</p></div>
          <div className={styles.footerLinks}>
            <nav aria-label={t.footerExplore}><strong>{t.footerExplore}</strong>{t.nav.map((label, index) => <a href={`#${sectionIds[index]}`} key={label}>{label}</a>)}</nav>
            <nav aria-label={t.footerCompany}><strong>{t.footerCompany}</strong><a href="https://iautomexa.com/">iautomexa ↗</a><a href={CONTACT}>{t.cta} ↗</a></nav>
          </div>
        </div>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} iautomexa · Loyalty</span><span>{t.footer}</span><Link href={otherLocale} hrefLang={otherHrefLang}>{t.lang} ↗</Link></div>
      </div>
    </footer>
  </MarketingMotion>;
}
