"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./CardShowcase.module.css";

type Locale = "es" | "en";

const cards = [
  {
    id: "barber", mark: "✂", bg: "#243045", accent: "#f6b77d", light: "#fff1df", progress: 2, goal: 6,
    es: { type: "Barberías", brand: "Corte Club", headline: "Cada corte deja huella.", reward: "Un detalle en tu visita 6", detail: "Una tarjeta para reconocer a quienes vuelven por su estilo." },
    en: { type: "Barbershops", brand: "Corte Club", headline: "Every cut counts.", reward: "A treat on visit 6", detail: "A card to recognize the people who return for their look." },
  },
  {
    id: "icecream", mark: "✳", bg: "#6647c7", accent: "#ffd58e", light: "#f9f1ff", progress: 3, goal: 8,
    es: { type: "Heladerías", brand: "Nube Helados", headline: "El antojo siempre vuelve.", reward: "Un helado al completar 8 visitas", detail: "Convierte cada visita en una excusa deliciosa para regresar." },
    en: { type: "Ice cream shops", brand: "Nube Ice Cream", headline: "Cravings come back.", reward: "An ice cream after 8 visits", detail: "Turn each visit into a sweet reason to return." },
  },
  {
    id: "bakery", mark: "✦", bg: "#a94063", accent: "#ffe6a1", light: "#fff0f2", progress: 4, goal: 6,
    es: { type: "Reposterías", brand: "Miga & Miel", headline: "Momentos para repetir.", reward: "Un postre al completar 6 compras", detail: "Premia las pequeñas celebraciones que tus clientes comparten contigo." },
    en: { type: "Bakeries", brand: "Miga & Miel", headline: "Moments worth repeating.", reward: "A dessert after 6 purchases", detail: "Reward the little celebrations your customers share with you." },
  },
  {
    id: "caps", mark: "◈", bg: "#126d73", accent: "#adf3db", light: "#eafff8", progress: 2, goal: 5,
    es: { type: "Tiendas de gorras", brand: "Visera Studio", headline: "Tu estilo suma.", reward: "Un beneficio en tu compra 5", detail: "Haz que tu comunidad vuelva a descubrir lo nuevo de tu tienda." },
    en: { type: "Cap shops", brand: "Visera Studio", headline: "Style adds up.", reward: "A perk on purchase 5", detail: "Bring your community back to discover what is new in store." },
  },
  {
    id: "fastfood", mark: "✺", bg: "#da5b39", accent: "#ffe694", light: "#fff4e8", progress: 5, goal: 7,
    es: { type: "Comida rápida", brand: "Punto Burger", headline: "Una más, por favor.", reward: "Un complemento en tu visita 7", detail: "Reconoce a quien te elige incluso en los días más ocupados." },
    en: { type: "Quick-service food", brand: "Punto Burger", headline: "One more, please.", reward: "A side on visit 7", detail: "Recognize customers who choose you on their busiest days." },
  },
] as const;

export function CardShowcase({ locale }: { locale: Locale }) {
  const section = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const t = locale === "es" ? {
    eyebrow: "03 / UNA IDEA, MUCHAS FORMAS",
    title: "La lealtad no tiene un solo molde.",
    intro: "Desliza y descubre cómo se podría ver Loyalty en cinco giros distintos. Cada tarjeta tiene su propia identidad; el negocio decide las reglas.",
    instruction: "Desplázate para explorar",
    note: "Tarjetas y recompensas ilustrativas; no son promociones activas.",
    progress: "Visitas",
  } : {
    eyebrow: "03 / ONE IDEA, MANY FORMS",
    title: "Loyalty is never one-size-fits-all.",
    intro: "Scroll through five different businesses and see what Loyalty could look like. Every card has its own identity; the business sets the rules.",
    instruction: "Scroll to explore",
    note: "Illustrative cards and rewards; these are not active offers.",
    progress: "Visits",
  };

  useEffect(() => {
    const root = section.current;
    if (!root) return;
    let cancelled = false;
    let revert: (() => void) | undefined;
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      mm.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
        const items = Array.from(root.querySelectorAll<HTMLElement>(`.${styles.card}`));
        if (items.length !== cards.length) return;
        root.classList.add(styles.animated);
        gsap.set(items.slice(1), { yPercent: 16, scale: 0.86, opacity: 0, rotate: 8 });
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: root,
            start: "top top",
            end: () => `+=${Math.round(window.innerHeight * 0.72 * (items.length - 1))}`,
            pin: true,
            scrub: 0.7,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => setActive(Math.min(items.length - 1, Math.round(self.progress * (items.length - 1)))),
          },
        });
        items.slice(0, -1).forEach((item, index) => {
          timeline.to(item, { xPercent: -115, rotate: -15, scale: 0.82, opacity: 0, duration: 1, ease: "power2.inOut" }, index);
          timeline.to(items[index + 1], { yPercent: 0, rotate: 0, scale: 1, opacity: 1, duration: 1, ease: "power2.inOut" }, index);
        });
        return () => { root.classList.remove(styles.animated); };
      });
      revert = () => mm.revert();
    }).catch(() => { /* El carrusel sigue accesible sin animación si GSAP no carga. */ });
    return () => { cancelled = true; revert?.(); };
  }, []);

  return (
    <section id="aplicaciones" ref={section} className={styles.section} aria-labelledby="showcase-title">
      <div className={styles.wrap}>
        <div className={styles.intro}>
          <div><p className={styles.eyebrow}>{t.eyebrow}</p><h2 id="showcase-title">{t.title}</h2></div>
          <p>{t.intro}</p>
        </div>
        <div className={styles.stage}>
          <div className={styles.side}>
            <span className={styles.counter}>0{active + 1} <span>/ 0{cards.length}</span></span>
            <p>{cards[active][locale].type}</p>
            <div className={styles.progress} aria-hidden="true">{cards.map((card, index) => <span key={card.id} className={index === active ? styles.current : ""} />)}</div>
            <small>{t.instruction} <span aria-hidden="true">↓</span></small>
          </div>
          <ol className={styles.cards} aria-label={locale === "es" ? "Ejemplos de tarjetas por giro" : "Card examples by industry"} onScroll={(event) => {
            if (window.matchMedia("(min-width: 900px)").matches) return;
            const list = event.currentTarget;
            const center = list.scrollLeft + list.clientWidth / 2;
            const nearest = Array.from(list.children).reduce((best, child, index) => Math.abs((child as HTMLElement).offsetLeft + (child as HTMLElement).offsetWidth / 2 - center) < Math.abs((list.children[best] as HTMLElement).offsetLeft + (list.children[best] as HTMLElement).offsetWidth / 2 - center) ? index : best, 0);
            setActive(nearest);
          }}>
            {cards.map((card) => {
              const copy = card[locale];
              const style = { "--card-bg": card.bg, "--card-accent": card.accent, "--card-light": card.light } as CSSProperties;
              return <li key={card.id} className={styles.card} style={style}>
                <article className={styles.cardFace} aria-label={`${copy.type}: ${copy.brand}`}>
                  <div className={styles.cardTop}><span className={styles.cardMark}>{card.mark}</span><span>LOYALTY <b>BY IAUTOMEXA</b></span></div>
                  <div className={styles.cardMiddle}><span className={styles.cardCategory}>{copy.type}</span><strong>{copy.brand}</strong><h3>{copy.headline}</h3></div>
                  <div className={styles.cardBottom}><div><span>{t.progress} · {card.progress}/{card.goal}</span><div className={styles.stamps} aria-hidden="true">{Array.from({ length: card.goal }, (_, i) => <i key={i} className={i < card.progress ? styles.filled : ""} />)}</div></div><span className={styles.reward}>{copy.reward}</span></div>
                </article>
                <p className={styles.cardDetail}>{copy.detail}</p>
              </li>;
            })}
          </ol>
        </div>
        <div className={styles.mobileNav} aria-label={locale === "es" ? "Elegir giro" : "Choose industry"}>
          {cards.map((card, index) => <button type="button" key={card.id} aria-pressed={active === index} onClick={() => section.current?.querySelectorAll<HTMLElement>(`.${styles.card}`)[index]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })}>{card[locale].type}</button>)}
        </div>
        <p className={styles.note}>{t.note}</p>
      </div>
    </section>
  );
}
