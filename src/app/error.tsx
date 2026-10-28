"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./error.module.css";

/** Error genérico: nunca muestra detalles técnicos al usuario; el `digest` sirve para buscar en logs del servidor. */
export default function GlobalSegmentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const english = usePathname().startsWith("/en");
  return (
    <main id="contenido" role="alert" className={styles.page}>
      <div className={styles.wrap}>
        <Link href={english ? "/en" : "/"} className={styles.brand} aria-label="Loyalty by iautomexa"><span aria-hidden="true">✳</span> Loyalty.</Link>
        <div className={styles.content}>
          <p className={styles.kicker}>LOYALTY / {english ? "SOMETHING WENT WRONG" : "ALGO SALIÓ MAL"}</p>
          <h1>{english ? "Let's try that again." : "Intentémoslo de nuevo."}</h1>
          <p>{english ? "We couldn't finish this action. Please try again in a moment." : "No pudimos completar esta acción. Inténtalo de nuevo en un momento."}</p>
          {error.digest ? <p className={styles.reference}>{english ? "Reference" : "Referencia"}: {error.digest}</p> : null}
          <div className={styles.actions}><button type="button" onClick={reset}>{english ? "Try again" : "Reintentar"} <span aria-hidden="true">↗</span></button><Link href={english ? "/en" : "/"}>{english ? "Back to Loyalty" : "Volver a Loyalty"} <span aria-hidden="true">→</span></Link></div>
        </div>
        <p className={styles.foot}>{english ? "Technology by" : "Tecnología de"} <strong>iautomexa</strong></p>
      </div>
    </main>
  );
}
