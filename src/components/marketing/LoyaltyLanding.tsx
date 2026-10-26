"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import styles from "./LoyaltyLanding.module.css";

type Locale = "es" | "en";

const content = {
  es: {
    nav: ["Cómo funciona", "Beneficios", "Aplicaciones", "Preguntas"],
    demo: "Agenda una demo",
    explore: "Explora cómo funciona",
    brandLine: "Una tecnología de",
    eyebrow: "LEALTAD DIGITAL, SIN COMPLICACIONES",
    headline: <>Haz que cada visita{" "}<em>cuente.</em></>,
    intro: "Loyalty convierte compras cotidianas en relaciones duraderas. Crea un programa de lealtad digital para tu negocio, reconoce a tus clientes y dales una razón clara para volver.",
    assurances: ["Sin app para tus clientes", "Reglas claras para tu equipo", "Crece con tus sucursales"],
    previewLabel: "ASÍ PODRÍA VERSE TU PROGRAMA",
    previewDisclaimer: "Vista ilustrativa · datos de ejemplo",
    exampleBusiness: "Tu negocio",
    exampleCard: "Tarjeta digital",
    exampleProgress: "5 de 8 visitas",
    exampleReward: "Tu próxima recompensa está más cerca",
    exampleStamp: "VISITA CONFIRMADA",
    strip: ["Una visita", "Un vínculo", "Muchas razones para volver"],
    howEyebrow: "01 / ASÍ DE SIMPLE",
    howTitle: <>De “hola” a{" "}<em>“qué gusto verte de nuevo”.</em></>,
    howIntro: "Un recorrido simple para tus clientes y un flujo confiable para tu equipo.",
    steps: [
      { n: "01", title: "Invita", text: "Comparte un QR. Tu cliente abre su tarjeta en el navegador y se registra sin descargar otra app.", icon: "qr" },
      { n: "02", title: "Registra", text: "Tu equipo confirma la compra. Las reglas del programa se validan en el servidor, no en el teléfono.", icon: "check" },
      { n: "03", title: "Recompensa", text: "El progreso se vuelve visible. Cuando cumple las condiciones, tu cliente sabe qué puede canjear.", icon: "gift" },
    ],
    benefitsEyebrow: "02 / DISEÑADO PARA TODOS",
    benefitsTitle: <>La lealtad funciona mejor cuando{" "}<em>se siente fácil.</em></>,
    benefits: [
      { who: "PARA TUS CLIENTES", title: "Un motivo para regresar", text: "Su tarjeta y progreso están siempre a la mano. Sin plásticos que perder ni pasos difíciles de entender.", icon: "heart" },
      { who: "PARA TU EQUIPO", title: "Una operación más ligera", text: "Registra compras y canjes con un flujo guiado, pensado para el ritmo real de tu negocio.", icon: "spark" },
      { who: "PARA TU NEGOCIO", title: "Decisiones con contexto", text: "Consulta actividad y recurrencia para entender cómo se usa el programa, sin cifras de escaparate.", icon: "chart" },
    ],
    applicationsEyebrow: "03 / TÚ PONES LAS REGLAS",
    applicationsTitle: <>No existe un solo modo de{" "}<em>crear comunidad.</em></>,
    applicationsIntro: "Elige un ejemplo y descubre cómo puede adaptarse un programa a cada tipo de negocio.",
    examples: [
      { tab: "Cafeterías", label: "CAFETERÍA", business: "Tu cafetería", offer: "Un café para volver", rule: "Después de 8 visitas válidas, una bebida de cortesía.", reward: "1 bebida", color: "coffee" },
      { tab: "Restaurantes", label: "RESTAURANTE", business: "Tu restaurante", offer: "Cada mesa cuenta", rule: "Después de 6 compras válidas, un postre de cortesía.", reward: "1 postre", color: "restaurant" },
      { tab: "Tiendas", label: "TIENDA", business: "Tu tienda", offer: "Gracias por elegirnos", rule: "Después de 5 compras válidas, un beneficio definido por tu negocio.", reward: "Tu beneficio", color: "store" },
    ],
    exampleNote: "Ejemplos conceptuales. Las reglas reales se configuran para cada negocio.",
    pilot: "Conoce el piloto Café Nómada",
    technologyEyebrow: "HECHO POR IAUTOMEXA",
    technologyTitle: <>La experiencia es sencilla.{" "}<em>La tecnología detrás, sólida.</em></>,
    technologyText: "Loyalty es una tecnología de iautomexa: software diseñado para negocios que necesitan más que una tarjeta de sellos. Las reglas de saldo, elegibilidad y canje viven en el servidor, con historial auditable y una base preparada para varias empresas y sucursales.",
    technologyLink: "Conoce iautomexa",
    techTags: ["Reglas en servidor", "Historial auditable", "Arquitectura multiempresa"],
    faqEyebrow: "04 / PREGUNTAS FRECUENTES",
    faqTitle: <>Todo claro{" "}<em>desde el inicio.</em></>,
    faqs: [
      ["¿Mis clientes tienen que descargar una app?", "No. Abren su tarjeta digital en el navegador. Algunas integraciones, como Wallet, dependen de configuración adicional."],
      ["¿Se puede usar en más de una sucursal?", "Sí. La plataforma está diseñada para operar con varias sucursales, respetando las reglas de cada negocio."],
      ["¿Ya está listo para contratar?", "Estamos preparando el piloto. Agenda una demo para conocer el estado actual y diseñar el programa adecuado para tu negocio."],
    ],
    finalEyebrow: "TU SIGUIENTE VISITA EMPIEZA AQUÍ",
    finalTitle: <>Hagamos que quieran{" "}<em>volver.</em></>,
    finalText: "Cuéntanos qué vendes y cómo quieres agradecer a quienes te eligen. Nosotros te mostramos lo que Loyalty puede hacer hoy.",
    footer: "Lealtad digital para negocios que quieren crecer con sus clientes.",
    privacy: "Privacidad",
    menu: "Menú",
    lang: "English",
  },
  en: {
    nav: ["How it works", "Benefits", "Use cases", "Questions"],
    demo: "Book a demo",
    explore: "See how it works",
    brandLine: "Technology by",
    eyebrow: "DIGITAL LOYALTY, MADE SIMPLE",
    headline: <>Make every visit{" "}<em>count.</em></>,
    intro: "Loyalty turns everyday purchases into lasting relationships. Create a digital loyalty program for your business, recognize your customers, and give them a clear reason to return.",
    assurances: ["No app for customers", "Clear rules for your team", "Ready for more locations"],
    previewLabel: "A LOOK AT YOUR FUTURE PROGRAM",
    previewDisclaimer: "Illustrative preview · sample data",
    exampleBusiness: "Your business",
    exampleCard: "Digital card",
    exampleProgress: "5 of 8 visits",
    exampleReward: "Your next reward is getting closer",
    exampleStamp: "VISIT CONFIRMED",
    strip: ["One visit", "One connection", "Many reasons to return"],
    howEyebrow: "01 / THAT SIMPLE",
    howTitle: <>From “hello” to{" "}<em>“great to see you again”.</em></>,
    howIntro: "A simple journey for customers and a reliable workflow for your team.",
    steps: [
      { n: "01", title: "Invite", text: "Share a QR code. Customers open their card in the browser and sign up without downloading an app.", icon: "qr" },
      { n: "02", title: "Record", text: "Your team confirms the purchase. Program rules are checked on the server, not on the phone.", icon: "check" },
      { n: "03", title: "Reward", text: "Progress becomes visible. When customers qualify, they know exactly what they can redeem.", icon: "gift" },
    ],
    benefitsEyebrow: "02 / MADE FOR EVERYONE",
    benefitsTitle: <>Loyalty works better when{" "}<em>it feels effortless.</em></>,
    benefits: [
      { who: "FOR CUSTOMERS", title: "A reason to return", text: "Their card and progress are always close by. No plastic to lose or confusing steps to follow.", icon: "heart" },
      { who: "FOR YOUR TEAM", title: "A lighter workflow", text: "Record purchases and redemptions with a guided flow built for the pace of a real business.", icon: "spark" },
      { who: "FOR YOUR BUSINESS", title: "Decisions with context", text: "See activity and repeat visits to understand how the program is used, without vanity numbers.", icon: "chart" },
    ],
    applicationsEyebrow: "03 / YOUR RULES",
    applicationsTitle: <>There is no single way to{" "}<em>build a community.</em></>,
    applicationsIntro: "Choose an example to see how a loyalty program can fit different businesses.",
    examples: [
      { tab: "Cafés", label: "CAFÉ", business: "Your café", offer: "A coffee worth returning for", rule: "After 8 valid visits, a complimentary drink.", reward: "1 drink", color: "coffee" },
      { tab: "Restaurants", label: "RESTAURANT", business: "Your restaurant", offer: "Every table counts", rule: "After 6 valid purchases, a complimentary dessert.", reward: "1 dessert", color: "restaurant" },
      { tab: "Shops", label: "SHOP", business: "Your shop", offer: "Thanks for choosing us", rule: "After 5 valid purchases, a benefit defined by your business.", reward: "Your benefit", color: "store" },
    ],
    exampleNote: "Concept examples. Actual rules are configured for each business.",
    pilot: "Explore the Café Nómada pilot",
    technologyEyebrow: "BUILT BY IAUTOMEXA",
    technologyTitle: <>A simple experience.{" "}<em>Solid technology underneath.</em></>,
    technologyText: "Loyalty is technology by iautomexa: software for businesses that need more than a digital punch card. Balance, eligibility, and redemption rules run on the server, with an auditable history and a foundation for multiple businesses and locations.",
    technologyLink: "Discover iautomexa",
    techTags: ["Server-side rules", "Auditable history", "Multi-business architecture"],
    faqEyebrow: "04 / FREQUENTLY ASKED",
    faqTitle: <>Clear from{" "}<em>day one.</em></>,
    faqs: [
      ["Do my customers need to download an app?", "No. They open their digital card in the browser. Some integrations, such as Wallet, require additional configuration."],
      ["Can I use it at multiple locations?", "Yes. The platform is designed for multiple locations while respecting each business's rules."],
      ["Is it ready to purchase?", "We are preparing the pilot. Book a demo to learn the current status and design the right program for your business."],
    ],
    finalEyebrow: "YOUR NEXT VISIT STARTS HERE",
    finalTitle: <>Give them a reason{" "}<em>to return.</em></>,
    finalText: "Tell us what you sell and how you want to thank the people who choose you. We'll show you what Loyalty can do today.",
    footer: "Digital loyalty for businesses growing with their customers.",
    privacy: "Privacy",
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [exampleIndex, setExampleIndex] = useState(0);
  const selected = t.examples[exampleIndex];
  const otherLocale = locale === "es" ? "/en" : "/";
  const ids = ["como-funciona", "beneficios", "aplicaciones", "preguntas"];

  useEffect(() => {
    document.documentElement.lang = locale === "es" ? "es-MX" : "en";
    const root = rootRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add(styles.visible);
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    root.querySelectorAll(`.${styles.reveal}`).forEach(item => observer.observe(item));
    return () => observer.disconnect();
  }, [locale]);

  return <div ref={rootRef} className={styles.site}>
    <header className={styles.header}>
      <div className={styles.wrap}>
        <Link href={locale === "es" ? "/" : "/en"} className={styles.logo} aria-label="Loyalty by iautomexa">
          <span className={styles.logoMark} aria-hidden="true">✳</span><span>Loyalty<span className={styles.logoDot}>.</span></span>
        </Link>
        <nav className={styles.desktopNav} aria-label={locale === "es" ? "Navegación principal" : "Main navigation"}>
          {t.nav.map((label, index) => <a href={`#${ids[index]}`} key={label}>{label}</a>)}
        </nav>
        <div className={styles.headerActions}>
          <Link className={styles.language} href={otherLocale} hrefLang={locale === "es" ? "en" : "es-MX"} aria-label={locale === "es" ? "View in English" : "Ver en español"}>{t.lang}</Link>
          <a className={`${styles.button} ${styles.buttonDark} ${styles.headerCta}`} href="https://iautomexa.com/contacto/">{t.demo} <Arrow diagonal /></a>
          <details className={styles.mobileMenu}><summary>{t.menu} <span aria-hidden="true">☰</span></summary><div>{t.nav.map((label, index) => <a href={`#${ids[index]}`} key={label}>{label}</a>)}<a href="https://iautomexa.com/contacto/">{t.demo}</a></div></details>
        </div>
      </div>
    </header>

    <main id="contenido">
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroGrid} aria-hidden="true" />
      <div className={`${styles.wrap} ${styles.heroLayout}`}>
        <div className={styles.heroCopy}>
          <a className={styles.brandPill} href="https://iautomexa.com/"><span className={styles.pillSpark} aria-hidden="true">✳</span>{t.brandLine} <strong>iautomexa</strong><Arrow diagonal /></a>
          <p className={styles.eyebrow}>{t.eyebrow}</p>
          <h1 id="hero-title">{t.headline}</h1>
          <p className={styles.lead}>{t.intro}</p>
          <div className={styles.heroActions}><a className={`${styles.button} ${styles.buttonBlue}`} href="https://iautomexa.com/contacto/">{t.demo} <Arrow diagonal /></a><a className={styles.textButton} href="#como-funciona">{t.explore} <Arrow /></a></div>
          <ul className={styles.assurances}>{t.assurances.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul>
        </div>
        <div className={styles.heroArt}>
          <div className={styles.artSwoosh} aria-hidden="true" />
          <div className={styles.artAsterisk} aria-hidden="true">✳</div>
          <figure className={styles.heroFigure} aria-label={locale === "es" ? "Ejemplo de tarjeta digital de lealtad" : "Illustrative digital loyalty card"}>
            <div className={styles.figureTop}><span>{t.previewLabel}</span><span className={styles.figureDot} /></div>
            <div className={styles.customerCard}>
              <div className={styles.cardTop}><span className={styles.cardBusiness}><span aria-hidden="true">✳</span>{t.exampleBusiness}</span><span>{t.exampleCard}</span></div>
              <div className={styles.cardCenter}><span className={styles.cardOverline}>LOYALTY CLUB</span><strong>{t.exampleProgress}</strong><div className={styles.stamps} aria-hidden="true">{Array.from({ length: 8 }, (_, i) => <span key={i} className={i < 5 ? styles.stampFilled : ""}>{i < 5 ? "✳" : ""}</span>)}</div><p>{t.exampleReward}</p></div>
              <div className={styles.cardBottom}><span>LOYALTY / IAUTOMEXA</span><span>✳</span></div>
            </div>
            <div className={styles.confirmation}><span className={styles.confirmIcon} aria-hidden="true">✓</span><div><strong>{t.exampleStamp}</strong><span>+1 / 05 → 06</span></div><span aria-hidden="true">✦</span></div>
            <figcaption>{t.previewDisclaimer}</figcaption>
          </figure>
          <div className={styles.artBubble} aria-hidden="true">♥</div>
        </div>
      </div>
    </section>

    <div className={styles.ribbon} aria-label={t.strip.join(" · ")}><div>{t.strip.map(item => <span key={item}>{item}<b aria-hidden="true">✳</b></span>)}</div></div>

    <section id="como-funciona" className={`${styles.section} ${styles.how}`} aria-labelledby="how-title"><div className={styles.wrap}>
      <div className={`${styles.sectionHead} ${styles.reveal}`}><div><p className={styles.sectionEyebrow}>{t.howEyebrow}</p><h2 id="how-title">{t.howTitle}</h2></div><p>{t.howIntro}</p></div>
      <ol className={styles.steps}>{t.steps.map(step => <li className={styles.reveal} key={step.n}><span className={styles.stepNumber}>{step.n}</span><span className={styles.stepIcon}><Symbol name={step.icon} /></span><h3>{step.title}</h3><p>{step.text}</p><span className={styles.stepArrow} aria-hidden="true">↗</span></li>)}</ol>
    </div></section>

    <section id="beneficios" className={`${styles.section} ${styles.benefits}`} aria-labelledby="benefits-title"><div className={styles.wrap}>
      <div className={`${styles.sectionHead} ${styles.reveal}`}><div><p className={styles.sectionEyebrow}>{t.benefitsEyebrow}</p><h2 id="benefits-title">{t.benefitsTitle}</h2></div></div>
      <div className={styles.benefitGrid}>{t.benefits.map((benefit, i) => <article className={`${styles.benefitCard} ${styles.reveal}`} key={benefit.who}><div className={styles.benefitVisual}><span className={styles.visualNumber}>0{i + 1}</span><span className={styles.benefitSymbol}><Symbol name={benefit.icon} /></span>{i === 0 && <span className={styles.miniHeart} aria-hidden="true">♥</span>}{i === 1 && <span className={styles.miniSpark} aria-hidden="true">✳</span>}{i === 2 && <span className={styles.miniBars} aria-hidden="true">▁ ▃ ▆ █</span>}</div><div className={styles.benefitBody}><span>{benefit.who}</span><h3>{benefit.title}</h3><p>{benefit.text}</p></div></article>)}</div>
    </div></section>

    <section id="aplicaciones" className={`${styles.section} ${styles.applications}`} aria-labelledby="applications-title"><div className={`${styles.wrap} ${styles.applicationLayout}`}>
      <div className={`${styles.applicationCopy} ${styles.reveal}`}><p className={styles.sectionEyebrow}>{t.applicationsEyebrow}</p><h2 id="applications-title">{t.applicationsTitle}</h2><p>{t.applicationsIntro}</p><div className={styles.tabs} role="group" aria-label={locale === "es" ? "Ejemplos de programas" : "Program examples"}>{t.examples.map((example, index) => <button type="button" key={example.tab} className={index === exampleIndex ? styles.activeTab : ""} aria-pressed={index === exampleIndex} onClick={() => setExampleIndex(index)}>{example.tab}<Arrow diagonal /></button>)}</div><Link className={styles.pilotLink} href="/c/cafe-nomada">{t.pilot} <Arrow /></Link></div>
      <div className={`${styles.applicationDemo} ${styles.reveal}`}><div className={`${styles.exampleCard} ${styles[selected.color]}`} aria-live="polite"><div className={styles.exampleCardTop}><span>✳ &nbsp; LOYALTY</span><span>{selected.label}</span></div><span className={styles.exampleBusiness}>{selected.business}</span><strong>{selected.offer}</strong><div className={styles.exampleBottom}><span>{selected.rule}</span><span className={styles.rewardBubble}>{selected.reward}</span></div></div><p>{t.exampleNote}</p></div>
    </div></section>

    <section className={styles.technology} aria-labelledby="technology-title"><div className={`${styles.wrap} ${styles.technologyLayout}`}><div className={styles.techDecoration} aria-hidden="true"><span>✳</span><span>iautomexa</span></div><div className={styles.reveal}><p className={styles.sectionEyebrow}>{t.technologyEyebrow}</p><h2 id="technology-title">{t.technologyTitle}</h2><p>{t.technologyText}</p><ul>{t.techTags.map(tag => <li key={tag}><span aria-hidden="true">✓</span>{tag}</li>)}</ul><a href="https://iautomexa.com/" className={`${styles.button} ${styles.buttonWhite}`}>{t.technologyLink} <Arrow diagonal /></a></div></div></section>

    <section id="preguntas" className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-title"><div className={`${styles.wrap} ${styles.faqLayout}`}><div className={styles.reveal}><p className={styles.sectionEyebrow}>{t.faqEyebrow}</p><h2 id="faq-title">{t.faqTitle}</h2></div><div className={styles.faqItems}>{t.faqs.map(([question, answer]) => <details key={question} className={styles.reveal}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></section>

    <section className={styles.final}><div className={`${styles.wrap} ${styles.finalLayout}`}><div><p className={styles.sectionEyebrow}>{t.finalEyebrow}</p><h2>{t.finalTitle}</h2><p>{t.finalText}</p></div><a href="https://iautomexa.com/contacto/" className={`${styles.button} ${styles.buttonDark}`}>{t.demo} <Arrow diagonal /></a><span className={styles.finalSpark} aria-hidden="true">✳</span></div></section>
    </main>
    <footer className={styles.footer}><div className={styles.wrap}><div className={styles.footerBrand}><span>✳ Loyalty<span className={styles.logoDot}>.</span></span><p>{t.footer}</p></div><div className={styles.footerLinks}><Link href="/privacidad">{t.privacy}</Link><a href="https://iautomexa.com/">{t.brandLine} <strong>iautomexa</strong> ↗</a></div></div></footer>
  </div>;
}
