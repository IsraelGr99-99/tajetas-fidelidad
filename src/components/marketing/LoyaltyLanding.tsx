import Link from "next/link";
import { CardShowcase } from "./CardShowcase";
import { DemoPlayground } from "./DemoPlayground";
import { MarketingMotion } from "./MarketingMotion";
import styles from "./LoyaltyLanding.module.css";

type Locale = "es" | "en";

const content = {
  es: {
    nav: ["Cómo funciona", "Prueba la demo", "Tarjetas por giro", "Preguntas"],
    demo: "Solicitar información",
    tryDemo: "Probar demo interactiva",
    brandLine: "Una tecnología de",
    eyebrow: "LA LEALTAD ES SOLO EL COMIENZO",
    headline: <>Haz que cada visita{" "}<em>cuente.</em></>,
    intro: "Mucho más que una tarjeta de sellos: conecta caja, inventario, clientes y recompensas en un solo espacio. Haz que cada compra cuente para tu negocio y para quien vuelve a elegirte.",
    assurances: ["Sin app para tus clientes", "Caja e inventario conectados", "Panel para entender tu negocio"],
    previewLabel: "ASÍ PODRÍA VERSE TU PROGRAMA",
    previewDisclaimer: "Vista ilustrativa · datos de ejemplo",
    exampleBusiness: "Tu negocio",
    exampleCard: "Tarjeta digital",
    exampleProgress: "5 de 8 visitas",
    exampleReward: "Tu próxima recompensa está más cerca",
    exampleStamp: "VISITA CONFIRMADA",
    strip: ["Una venta", "Una relación", "Un negocio mejor conectado"],
    howEyebrow: "01 / ASÍ DE SIMPLE",
    howTitle: <>De “hola” a{" "}<em>“qué gusto verte de nuevo”.</em></>,
    howIntro: "La experiencia es ligera para el cliente; detrás hay herramientas para operar el día a día.",
    steps: [
      { n: "01", title: "Invita", text: "Comparte un QR. Tu cliente abre su tarjeta en el navegador y se registra sin descargar otra app.", icon: "qr" },
      { n: "02", title: "Vende y organiza", text: "Tu equipo registra la venta. Caja puede conectar productos, recetas, existencias por sucursal y actividad del personal.", icon: "check" },
      { n: "03", title: "Reconoce y aprende", text: "La compra puede sumar progreso a la tarjeta; el panel te ayuda a revisar clientes, ventas y alertas para decidir mejor.", icon: "gift" },
    ],
    benefitsEyebrow: "PARA CADA PERSONA EN EL RECORRIDO",
    benefitsTitle: <>La lealtad funciona mejor cuando{" "}<em>se siente fácil.</em></>,
    benefits: [
      { who: "PARA TUS CLIENTES", title: "Un motivo para regresar", text: "Su tarjeta y progreso están siempre a la mano. Sin plásticos que perder ni pasos difíciles de entender.", icon: "heart" },
      { who: "PARA TU EQUIPO", title: "Una operación más ligera", text: "Registra compras y canjes con un flujo guiado, pensado para el ritmo real de tu negocio.", icon: "spark" },
      { who: "PARA TU NEGOCIO", title: "Decisiones con contexto", text: "Consulta ventas, existencias, clientes y recurrencia por sucursal en un panel que muestra datos útiles, no cifras de escaparate.", icon: "chart" },
    ],
    technologyEyebrow: "HECHO POR IAUTOMEXA",
    technologyTitle: <>La experiencia es sencilla.{" "}<em>La tecnología detrás, sólida.</em></>,
    technologyText: "Loyalty es tecnología de iautomexa para negocios que necesitan más que una tarjeta de sellos. Caja, inventario, clientes y fidelidad comparten un flujo; las reglas de saldo, elegibilidad y canje viven en el servidor, con historial auditable y una base multiempresa.",
    technologyLink: "Conoce iautomexa",
    techTags: ["Operación por sucursal", "Reglas en servidor", "Historial auditable"],
    techMapTitle: "Un flujo, no herramientas aisladas",
    techMapNote: "Vista conceptual de los módulos de Loyalty",
    techModules: ["Caja", "Inventario", "Clientes", "Fidelidad"],
    faqEyebrow: "04 / PREGUNTAS FRECUENTES",
    faqTitle: <>Todo claro{" "}<em>desde el inicio.</em></>,
    faqs: [
      ["¿Mis clientes tienen que descargar una app?", "No. Abren su tarjeta digital en el navegador. Algunas integraciones, como Wallet, dependen de configuración adicional."],
      ["¿Se puede usar en más de una sucursal?", "Sí. La plataforma está diseñada para operar con varias sucursales, respetando las reglas de cada negocio."],
      ["¿Qué incluye además de la tarjeta?", "El piloto reúne caja, productos y variantes, inventario por sucursal, recetas, clientes, actividad de ventas y herramientas de fidelidad. Algunas integraciones, como el cobro con tarjeta integrado y la impresión física, siguen pendientes."],
      ["¿Puedo probarlo sin cuenta?", "Sí. La demo interactiva de esta página usa datos ficticios y no guarda nada. Si quieres conocer el piloto real y su disponibilidad, solicita información a iautomexa."],
    ],
    finalEyebrow: "TU SIGUIENTE VISITA EMPIEZA AQUÍ",
    finalTitle: <>Hagamos que quieran{" "}<em>volver.</em></>,
    finalText: "Prueba el recorrido sin crear una cuenta. Después cuéntanos qué vendes y cómo te gustaría reconocer a quienes vuelven: te mostraremos lo que Loyalty hace hoy y qué viene después.",
    footer: "Lealtad digital para negocios que quieren crecer con sus clientes.",
    footerTitle: "Cada visita puede ser el comienzo de algo más.",
    footerExplore: "Explora",
    footerCompany: "Compañía",
    menu: "Menú",
    lang: "English",
  },
  en: {
    nav: ["How it works", "Try the demo", "Cards by industry", "Questions"],
    demo: "Request information",
    tryDemo: "Try the interactive demo",
    brandLine: "Technology by",
    eyebrow: "LOYALTY IS JUST THE BEGINNING",
    headline: <>Make every visit{" "}<em>count.</em></>,
    intro: "More than a punch card: connect checkout, inventory, customers, and rewards in one workspace. Make every purchase count for your business and for the people who keep choosing you.",
    assurances: ["No app for customers", "Connected checkout and inventory", "A dashboard for your business"],
    previewLabel: "A LOOK AT YOUR FUTURE PROGRAM",
    previewDisclaimer: "Illustrative preview · sample data",
    exampleBusiness: "Your business",
    exampleCard: "Digital card",
    exampleProgress: "5 of 8 visits",
    exampleReward: "Your next reward is getting closer",
    exampleStamp: "VISIT CONFIRMED",
    strip: ["One sale", "One relationship", "A better connected business"],
    howEyebrow: "01 / THAT SIMPLE",
    howTitle: <>From “hello” to{" "}<em>“great to see you again”.</em></>,
    howIntro: "A light experience for customers, with practical tools behind the scenes.",
    steps: [
      { n: "01", title: "Invite", text: "Share a QR code. Customers open their card in the browser and sign up without downloading an app.", icon: "qr" },
      { n: "02", title: "Sell and organize", text: "Your team records a sale. Checkout can connect products, recipes, stock by location, and employee activity.", icon: "check" },
      { n: "03", title: "Recognize and learn", text: "A purchase can add progress to a card; the dashboard helps you review customers, sales, and alerts.", icon: "gift" },
    ],
    benefitsEyebrow: "FOR EVERYONE IN THE JOURNEY",
    benefitsTitle: <>Loyalty works better when{" "}<em>it feels effortless.</em></>,
    benefits: [
      { who: "FOR CUSTOMERS", title: "A reason to return", text: "Their card and progress are always close by. No plastic to lose or confusing steps to follow.", icon: "heart" },
      { who: "FOR YOUR TEAM", title: "A lighter workflow", text: "Record purchases and redemptions with a guided flow built for the pace of a real business.", icon: "spark" },
      { who: "FOR YOUR BUSINESS", title: "Decisions with context", text: "See sales, stock, customers, and repeat visits by location in a dashboard focused on useful data, not vanity numbers.", icon: "chart" },
    ],
    technologyEyebrow: "BUILT BY IAUTOMEXA",
    technologyTitle: <>A simple experience.{" "}<em>Solid technology underneath.</em></>,
    technologyText: "Loyalty is technology by iautomexa for businesses that need more than a punch card. Checkout, inventory, customers, and loyalty share a workflow; balance, eligibility, and redemption rules run on the server, backed by an auditable history and a multi-business foundation.",
    technologyLink: "Discover iautomexa",
    techTags: ["By-location operations", "Server-side rules", "Auditable history"],
    techMapTitle: "One workflow, not disconnected tools",
    techMapNote: "Conceptual view of Loyalty modules",
    techModules: ["Checkout", "Inventory", "Customers", "Loyalty"],
    faqEyebrow: "04 / FREQUENTLY ASKED",
    faqTitle: <>Clear from{" "}<em>day one.</em></>,
    faqs: [
      ["Do my customers need to download an app?", "No. They open their digital card in the browser. Some integrations, such as Wallet, require additional configuration."],
      ["Can I use it at multiple locations?", "Yes. The platform is designed for multiple locations while respecting each business's rules."],
      ["What is included beyond the card?", "The pilot brings together checkout, products and variants, location-based inventory, recipes, customers, sales activity, and loyalty tools. Some integrations, such as integrated card payments and physical printing, are still pending."],
      ["Can I try it without an account?", "Yes. The interactive demo on this page uses sample data and saves nothing. To learn about the real pilot and its availability, contact iautomexa."],
    ],
    finalEyebrow: "YOUR NEXT VISIT STARTS HERE",
    finalTitle: <>Give them a reason{" "}<em>to return.</em></>,
    finalText: "Try the journey without creating an account. Then tell us what you sell and how you want to recognize returning customers. We will show you what Loyalty does today and what is coming next.",
    footer: "Digital loyalty for businesses growing with their customers.",
    footerTitle: "Every visit can be the start of something more.",
    footerExplore: "Explore",
    footerCompany: "Company",
    menu: "Menu",
    lang: "Español",
  },
} as const;

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <span aria-hidden="true">{diagonal ? "↗" : "→"}</span>;
}

function Symbol({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return <svg viewBox="0 0 32 32" aria-hidden="true" {...common}>
    {name === "qr" && <><path d="M3 3h10v10H3zM19 3h10v10H19zM3 19h10v10H3zM19 19h4v4h-4zM27 19h2v10h-8v-3h5" /><path d="M6 6h4v4H6zM22 6h4v4h-4zM6 22h4v4H6z" /></>}
    {name === "check" && <><circle cx="16" cy="16" r="12" /><path d="m10 16 4 4 8-9" /></>}
    {name === "gift" && <><path d="M4 13h24v15H4zM2 9h28v5H2zM16 9v19" /><path d="M16 9c-9 0-10-7-6-7 3 0 6 4 6 7Zm0 0c9 0 10-7 6-7-3 0-6 4-6 7Z" /></>}
    {name === "heart" && <path d="M16 28 4.6 16.5C-2 9.5 7.1 1 14 7.5L16 9.4l2-1.9C24.9 1 34 9.5 27.4 16.5L16 28Z" />}
    {name === "spark" && <><path d="m16 2 2.9 10.9L30 16l-11.1 3.1L16 30l-2.9-10.9L2 16l11.1-3.1L16 2Z" /><path d="M16 11v10M11 16h10" /></>}
    {name === "chart" && <><path d="M4 27h24M7 23v-6h5v6M14 23V9h5v14M21 23V4h5v19" /></>}
  </svg>;
}

export function LoyaltyLanding({ locale }: { locale: Locale }) {
  const t = content[locale];
  const otherLocale = locale === "es" ? "/en" : "/";
  const ids = ["como-funciona", "demo-interactiva", "aplicaciones", "preguntas"];

  return <MarketingMotion className={styles.site}>
    <header className={styles.header}>
      <div className={styles.wrap}>
        <Link href={locale === "es" ? "/" : "/en"} className={styles.logo} aria-label="Loyalty by iautomexa">
          <span className={styles.logoMark} aria-hidden="true">✳</span><span>Loyalty<span className={styles.logoDot}>.</span></span>
        </Link>
        <nav className={styles.desktopNav} aria-label={locale === "es" ? "Navegación principal" : "Main navigation"}>
          {t.nav.map((label, index) => <a data-section-link href={`#${ids[index]}`} key={label}>{label}</a>)}
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.language} href={otherLocale} hrefLang={locale === "es" ? "en" : "es-MX"} aria-label={locale === "es" ? "View in English" : "Ver en español"}>{t.lang}</Link>
          <a className={`${styles.button} ${styles.buttonDark} ${styles.headerCta}`} href="#demo-interactiva">{t.tryDemo} <Arrow diagonal /></a>
          <details data-mobile-menu className={styles.mobileMenu}><summary>{t.menu} <span aria-hidden="true">☰</span></summary><nav aria-label={locale === "es" ? "Navegación móvil" : "Mobile navigation"}>{t.nav.map((label, index) => <a data-section-link href={`#${ids[index]}`} key={label}>{label}</a>)}<a href="https://iautomexa.com/contacto/">{t.demo}</a></nav></details>
        </div>
      </div>
    </header>

    <main id="contenido">
    <section data-motion-hero className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.wrap}>
        <div className={styles.heroTopline} data-motion-brand>
          <a className={styles.brandPill} href="https://iautomexa.com/"><span className={styles.pillSpark} aria-hidden="true">✳</span>{t.brandLine} <strong>iautomexa</strong><Arrow diagonal /></a>
          <span className={styles.heroIndex}>LOYALTY / 001</span>
        </div>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 id="hero-title">{t.headline}</h1>
          <div className={styles.heroBottom}>
            <p data-motion-lead className={styles.lead}>{t.intro}</p>
            <div data-motion-actions className={styles.heroActions}><a className={`${styles.button} ${styles.buttonBlue}`} href="#demo-interactiva">{t.tryDemo} <Arrow diagonal /></a><a className={styles.textButton} href="https://iautomexa.com/contacto/">{t.demo} <Arrow /></a></div>
          </div>
        </div>
        <figure data-motion-visual className={styles.heroFigure} aria-label={locale === "es" ? "Ejemplo de tarjeta digital de lealtad" : "Illustrative digital loyalty card"}>
          <div className={styles.figureTop}><span>{t.previewLabel}</span><span className={styles.figureDot} /></div>
          <div className={styles.figureBody}>
            <div className={styles.customerCard}>
              <div className={styles.cardTop}><span className={styles.cardBusiness}><span aria-hidden="true">✳</span>{t.exampleBusiness}</span><span>{t.exampleCard}</span></div>
              <div className={styles.cardCenter}><span className={styles.cardOverline}>LOYALTY CLUB</span><strong>{t.exampleProgress}</strong><div className={styles.stamps} aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <span key={i} className={i < 5 ? styles.stampFilled : ""}>{i < 5 ? "✳" : ""}</span>)}</div><p>{t.exampleReward}</p></div>
              <div className={styles.cardBottom}><span>LOYALTY / IAUTOMEXA</span><span>✳</span></div>
            </div>
            <div className={styles.figureNarrative}>
              <span className={styles.figureAsterisk} aria-hidden="true">✳</span>
              <div className={styles.figureProgress}><span>01</span><p>{t.strip[0]}</p><span aria-hidden="true">↘</span></div>
              <div className={styles.figureProgress}><span>02</span><p>{t.strip[1]}</p><span aria-hidden="true">↘</span></div>
              <div className={`${styles.figureProgress} ${styles.figureProgressFinal}`}><span>03</span><p>{t.strip[2]}</p><span aria-hidden="true">↗</span></div>
              <div className={styles.confirmation}><span className={styles.confirmIcon} aria-hidden="true">✓</span><div><strong>{t.exampleStamp}</strong><span>+1 / 05 → 06</span></div></div>
            </div>
          </div>
          <figcaption>{t.previewDisclaimer}</figcaption>
        </figure>
        <ul className={styles.assurances}>{t.assurances.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
      </div>
    </section>

    <section data-motion-section id="como-funciona" className={`${styles.section} ${styles.how}`} aria-labelledby="how-title"><div className={`${styles.wrap} ${styles.howLayout}`}>
      <div className={styles.howIntro}><p className={styles.sectionEyebrow}>{t.howEyebrow}</p><h2 id="how-title">{t.howTitle}</h2><p>{t.howIntro}</p><a href="#demo-interactiva" className={styles.howLink}>{t.tryDemo} <Arrow diagonal /></a></div>
      <ol className={styles.steps}>{t.steps.map(step => <li key={step.n}><span className={styles.stepNumber}>{step.n}</span><span className={styles.stepIcon}><Symbol name={step.icon} /></span><div className={styles.stepCopy}><h3>{step.title}</h3><p>{step.text}</p></div><span className={styles.stepArrow} aria-hidden="true">↗</span></li>)}</ol>
    </div></section>

    <DemoPlayground locale={locale} />

    <section data-motion-section id="beneficios" className={`${styles.section} ${styles.benefits}`} aria-labelledby="benefits-title"><div className={styles.wrap}>
      <div className={styles.sectionHead}><div><p className={styles.sectionEyebrow}>{t.benefitsEyebrow}</p><h2 id="benefits-title">{t.benefitsTitle}</h2></div></div>
      <div className={styles.benefitGrid}>{t.benefits.map((benefit, i) => <article className={styles.benefitCard} key={benefit.who}><div className={styles.benefitVisual}><span className={styles.visualNumber}>0{i + 1}</span><span className={styles.benefitSymbol}><Symbol name={benefit.icon} /></span></div><div className={styles.benefitBody}><span>{benefit.who}</span><h3>{benefit.title}</h3><p>{benefit.text}</p></div><span className={styles.benefitArrow} aria-hidden="true">↗</span></article>)}</div>
    </div></section>

    <CardShowcase locale={locale} />

    <section data-motion-section className={styles.technology} aria-labelledby="technology-title"><div className={`${styles.wrap} ${styles.technologyLayout}`}><div><p className={styles.sectionEyebrow}>{t.technologyEyebrow}</p><h2 id="technology-title">{t.technologyTitle}</h2><p>{t.technologyText}</p><ul>{t.techTags.map(tag => <li key={tag}><span aria-hidden="true">✓</span>{tag}</li>)}</ul><a href="https://iautomexa.com/" className={`${styles.button} ${styles.buttonWhite}`}>{t.technologyLink} <Arrow diagonal /></a></div><figure className={styles.techMap}><div className={styles.techMapTop}><span className={styles.techMapLogo}>✳ Loyalty</span><span>IAUTOMEXA / PLATFORM</span></div><figcaption>{t.techMapTitle}</figcaption><div className={styles.techModules}>{t.techModules.map((module, index) => <div key={module}><span>0{index + 1}</span><strong>{module}</strong><span aria-hidden="true">↗</span></div>)}</div><p>{t.techMapNote}</p></figure></div></section>

    <section data-motion-section id="preguntas" className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-title"><div className={`${styles.wrap} ${styles.faqLayout}`}><div><p className={styles.sectionEyebrow}>{t.faqEyebrow}</p><h2 id="faq-title">{t.faqTitle}</h2></div><div className={styles.faqItems}>{t.faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></section>

    <section data-motion-section className={styles.final}><div className={`${styles.wrap} ${styles.finalLayout}`}><div><p className={styles.sectionEyebrow}>{t.finalEyebrow}</p><h2>{t.finalTitle}</h2><p>{t.finalText}</p></div><div className={styles.finalActions}><a href="#demo-interactiva" className={`${styles.button} ${styles.buttonBlue}`}>{t.tryDemo} <Arrow diagonal /></a><a href="https://iautomexa.com/contacto/" className={styles.textButton}>{t.demo} <Arrow /></a></div></div></section>
    </main>
    <footer className={styles.footer}><div className={styles.wrap}><div className={styles.footerMain}><div className={styles.footerBrand}><span>✳ Loyalty<span className={styles.logoDot}>.</span></span><p>{t.footerTitle}</p></div><div className={styles.footerLinks}><nav aria-label={t.footerExplore}><strong>{t.footerExplore}</strong><a href="#como-funciona">{t.nav[0]}</a><a href="#demo-interactiva">{t.nav[1]}</a><a href="#aplicaciones">{t.nav[2]}</a></nav><nav aria-label={t.footerCompany}><strong>{t.footerCompany}</strong><a href="https://iautomexa.com/">iautomexa ↗</a><a href="https://iautomexa.com/contacto/">{t.demo} ↗</a></nav></div></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} iautomexa · Loyalty</span><span>{t.footer}</span><Link href={otherLocale} hrefLang={locale === "es" ? "en" : "es-MX"}>{t.lang} ↗</Link></div></div></footer>
  </MarketingMotion>;
}
