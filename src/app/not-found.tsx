import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: { absolute: "Página no encontrada · iautomexa Loyalty" },
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const english = (await headers()).get("x-site-locale") === "en";
  return (
    <main id="contenido" className={styles.page}>
      <div className={styles.wrap}>
        <Link href={english ? "/en" : "/"} className={styles.brand} aria-label="Loyalty by iautomexa">
          <span className={styles.brandMark} aria-hidden="true">✳</span>
          Loyalty<span className={styles.brandDot}>.</span>
        </Link>
        <div className={styles.layout}>
          <div className={styles.copy}>
            <p className={styles.kicker}>404 / {english ? "PAGE NOT FOUND" : "PÁGINA NO ENCONTRADA"}</p>
            <h1>{english ? "This route took a different turn." : "Esta ruta tomó otro camino."}</h1>
            <p>{english ? "The page you were looking for is not here. Your next visit can still start in the right place." : "La página que buscabas no está aquí. Tu próxima visita sí puede empezar en el lugar correcto."}</p>
            <div className={styles.actions}>
              <Link href={english ? "/en" : "/"} className={styles.primary}>{english ? "Back to Loyalty" : "Volver a Loyalty"} <span aria-hidden="true">↗</span></Link>
              <a href="https://iautomexa.com/contacto/" className={styles.secondary}>{english ? "Contact us" : "Pedir información"} <span aria-hidden="true">→</span></a>
            </div>
          </div>
          <div className={styles.art} aria-hidden="true">
            <span className={styles.orbit} />
            <span className={styles.asterisk}>✳</span>
            <span className={styles.number}>404</span>
            <span className={styles.artTag}>LOYALTY / IAUTOMEXA</span>
          </div>
        </div>
        <div className={styles.foot}><span>{english ? "Technology by" : "Tecnología de"} <strong>iautomexa</strong></span><Link href={english ? "/" : "/en"}>{english ? "Español" : "English"}</Link></div>
      </div>
    </main>
  );
}
