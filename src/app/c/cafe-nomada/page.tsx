import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { PassportCard } from "@/components/loyalty/PassportCard";
import { PILOT_CAMPAIGN } from "@/domain/loyalty/campaign";
import { PHONE_AUTH_ENABLED } from "@/lib/business";
import styles from "./page.module.css";

const BUSINESS_URL = "https://iautomexa.com";

export const metadata: Metadata = {
  title: "Café Nómada · tarjeta de fidelidad",
  description: "Tarjeta de fidelidad digital de Café Nómada en San Pedro Cholula.",
  robots: { index: false, follow: false },
};

const steps = [
  {
    number: "01",
    title: "Crea tu tarjeta",
    body: PHONE_AUTH_ENABLED
      ? "Verifica tu correo o teléfono con un código. No necesitas contraseña ni descargar una app."
      : "Verifica tu correo con un código. No necesitas contraseña ni descargar una app.",
  },
  {
    number: "02",
    title: "Muestra tu QR al pagar",
    body: "El equipo registra tu compra elegible y tu sello aparece en la tarjeta.",
  },
  {
    number: "03",
    title: "Disfruta tu recompensa",
    body: `Después de ${PILOT_CAMPAIGN.stampsRequired} sellos, tendrás una bebida de cortesía para canjear.`,
  },
];

const rules = [
  "Un sello por cada compra elegible completada.",
  "Las compras anuladas, devueltas y las cortesías no suman.",
  "La bebida de regalo tiene como límite el precio de la bebida elegible más económica del ticket que completó tu tarjeta.",
  "Cada sello y canje queda visible en tu historial.",
];

export default function CafeNomadaPage() {
  return (
    <div className={styles.site}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/c/cafe-nomada" aria-label="Café Nómada, inicio" className={styles.brand}>
            <Wordmark />
          </Link>
          <nav aria-label="Navegación de Café Nómada" className={styles.nav}>
            <a href="#como-funciona" className={styles.navText}>Cómo funciona</a>
            <Link href="/tarjeta" className={styles.navCard}>Ver mi tarjeta <span aria-hidden="true">↗</span></Link>
          </nav>
        </div>
      </header>

      <main id="contenido" tabIndex={-1}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}><span className={styles.eyebrowDot} /> EL CAFÉ QUE VUELVE CONTIGO</p>
              <h1 id="hero-title">Historias que se cuentan <em>taza a taza.</em></h1>
              <p className={styles.heroDescription}>
                Tus visitas a Café Nómada ahora tienen recompensa. Junta {PILOT_CAMPAIGN.stampsRequired} sellos con tus compras elegibles y la siguiente bebida corre por nuestra cuenta.
              </p>
              <div className={styles.heroActions}>
                <Link href="/tarjeta/acceso" className={styles.primaryAction}>Quiero mi tarjeta <span aria-hidden="true">↗</span></Link>
                <a href="#como-funciona" className={styles.secondaryAction}>Así funciona <span aria-hidden="true">↓</span></a>
              </div>
              <p className={styles.heroNote}>Gratis · Sin app · Tu avance siempre a la mano</p>
            </div>
            <div className={styles.heroVisual}>
              <div className={styles.visualOrbit} aria-hidden="true" />
              <div className={styles.cardFrame}>
                <PassportCard
                  sample
                  intro
                  stampsBalance={5}
                  stampsRequired={PILOT_CAMPAIGN.stampsRequired}
                  rewardsAvailable={0}
                  rewardDescription={PILOT_CAMPAIGN.rewardDescription}
                />
              </div>
              <div className={styles.visualBadge} aria-hidden="true"><span>✳</span> Una visita más, un sello más</div>
            </div>
          </div>
          <div className={styles.heroBottom}>
            <span>HECHO PARA TUS MOMENTOS DE CAFÉ</span>
            <span>SAN PEDRO CHOLULA · PUEBLA</span>
          </div>
        </section>

        <section className={styles.valueSection} aria-label="Beneficios de tu tarjeta">
          <div className={styles.valueGrid}>
            <div><span className={styles.valueIcon} aria-hidden="true">✦</span><div><strong>Una tarjeta, siempre contigo</strong><p>Se abre desde el navegador de tu teléfono.</p></div></div>
            <div><span className={styles.valueIcon} aria-hidden="true">◎</span><div><strong>Cada visita cuenta</strong><p>Consulta tus sellos y recompensas cuando quieras.</p></div></div>
            <div><span className={styles.valueIcon} aria-hidden="true">↗</span><div><strong>Todo a la vista</strong><p>Tu historial muestra cada sello y cada canje.</p></div></div>
          </div>
        </section>

        <section id="como-funciona" className={styles.stepsSection} aria-labelledby="steps-title">
          <div className={styles.sectionInner}>
            <div className={styles.sectionHeading}>
              <p className={styles.kicker}>ASÍ DE FÁCIL</p>
              <h2 id="steps-title">Del primer café a tu próxima recompensa.</h2>
              <p>Sin tarjetas de papel ni pasos escondidos. Tú disfrutas el café; nosotros llevamos la cuenta.</p>
            </div>
            <ol className={styles.steps}>
              {steps.map((step) => (
                <li key={step.number}>
                  <span className={styles.stepNumber}>{step.number}</span>
                  <div><h3>{step.title}</h3><p>{step.body}</p></div>
                  <span className={styles.stepArrow} aria-hidden="true">↗</span>
                </li>
              ))}
            </ol>
            <Link href="/tarjeta/acceso" className={styles.inlineLink}>Empieza aquí <span aria-hidden="true">↗</span></Link>
          </div>
        </section>

        <section className={styles.detailsSection} aria-labelledby="rules-title">
          <div className={styles.detailsInner}>
            <div className={styles.rules}>
              <p className={styles.kicker}>TODO CLARO DESDE EL INICIO</p>
              <h2 id="rules-title">El buen café no necesita letra pequeña.</h2>
              <ul>
                {rules.map((rule) => <li key={rule}><span aria-hidden="true">✓</span>{rule}</li>)}
              </ul>
            </div>
            <aside className={styles.privacy} aria-labelledby="privacy-title">
              <div className={styles.privacyMark} aria-hidden="true">✳</div>
              <p className={styles.privacyLabel}>UN POCO DE CONFIANZA</p>
              <h3 id="privacy-title">Tu café es personal.<br />Tus datos también.</h3>
              <p>Solo pedimos un medio de contacto verificado para tu tarjeta. Tu QR no muestra tu correo, teléfono ni saldo, y siempre puedes consultar tu historial.</p>
              <Link href="/privacidad">Conoce cómo cuidamos tus datos <span aria-hidden="true">↗</span></Link>
            </aside>
          </div>
        </section>

        <section className={styles.finalSection} aria-labelledby="final-title">
          <div className={styles.finalInner}>
            <LogoMark className={styles.finalLogo} />
            <p className={styles.kicker}>TU PRÓXIMA VISITA EMPIEZA AQUÍ</p>
            <h2 id="final-title">Hay café para hoy.<br /><em>Y motivos para volver.</em></h2>
            <Link href="/tarjeta/acceso" className={styles.primaryAction}>Crear mi tarjeta <span aria-hidden="true">↗</span></Link>
            <p>Crear tu tarjeta es gratis y toma solo unos minutos.</p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>© {new Date().getFullYear()} Café Nómada · San Pedro Cholula</span>
          <div><Link href="/entrar">Acceso del personal</Link><a href={BUSINESS_URL}>Hecho con iautomexa</a></div>
        </div>
      </footer>
    </div>
  );
}
