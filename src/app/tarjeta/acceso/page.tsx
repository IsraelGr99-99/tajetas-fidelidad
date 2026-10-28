import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Logo";
import { PassportCard } from "@/components/loyalty/PassportCard";
import { PILOT_CAMPAIGN } from "@/domain/loyalty/campaign";
import { PHONE_AUTH_ENABLED } from "@/lib/business";
import { getCustomerSession } from "@/lib/customer/session";
import { customerSignOutAction } from "../actions";
import { AccessFlow } from "./AccessFlow";
import { ProfileForm } from "./ProfileForm";
import { ReactivateAccount } from "./ReactivateAccount";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Accede a tu tarjeta" };

export default async function CustomerAccessPage({ searchParams }: { searchParams: Promise<{ salida?: string; eliminada?: string; desactivada?: string }> }) {
  const { salida, eliminada, desactivada } = await searchParams;
  const session = await getCustomerSession();
  if (session.status === "enrolled") redirect("/tarjeta");

  const completing = session.status === "not_enrolled";
  const disabled = session.status === "disabled";

  const title = disabled ? "Tu tarjeta está desactivada" : completing ? "Completa tu tarjeta" : "Entra o crea tu tarjeta";
  const description = disabled
    ? "Puedes volver a activarla. Tus sellos y recompensas siguen guardados."
    : completing
      ? "Ya verificamos tu contacto. Confirma tus preferencias para terminar."
      : "El mismo acceso sirve para crear tu tarjeta o volver a entrar. Solo necesitas un código; no hay contraseñas.";

  return (
    <main id="contenido" className={styles.access}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/c/cafe-nomada" className={styles.brand} aria-label="Café Nómada, ir al inicio"><Wordmark /></Link>
          <Link href="/c/cafe-nomada" className={styles.back}>← <span>Conocer el programa</span></Link>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.story} aria-labelledby="story-title">
          <div className={styles.storyInner}>
            <p className={styles.storyKicker}><span aria-hidden="true">✳</span> CAFÉ NÓMADA · FIDELIDAD</p>
            <h2 id="story-title">Cada café tiene<br /><em>algo de regreso.</em></h2>
            <p className={styles.storyCopy}>Lleva tus sellos contigo, sigue tu avance y disfruta tu próxima bebida de cortesía.</p>
            <div className={styles.storyCard}>
              <PassportCard
                sample
                stampsBalance={4}
                stampsRequired={PILOT_CAMPAIGN.stampsRequired}
                rewardsAvailable={0}
                rewardDescription={PILOT_CAMPAIGN.rewardDescription}
              />
            </div>
            <p className={styles.storyNote}>Vista de ejemplo. Tus sellos reales aparecen después de entrar.</p>
          </div>
        </aside>

        <section className={styles.formArea} aria-labelledby="access-title">
          <div className={styles.formCard}>
            <div className={styles.formTop}>
              <span className={styles.formIcon} aria-hidden="true">✦</span>
              <p>{disabled ? "REACTIVAR TARJETA" : completing ? "UN ÚLTIMO PASO" : "TU TARJETA DIGITAL"}</p>
            </div>
            <h1 id="access-title">{title}</h1>
            <p className={styles.description}>{description}</p>

            {eliminada ? <p role="status" className={styles.success}>Eliminamos tus datos personales. Gracias por haber sido parte de la bitácora.</p> : null}
            {salida ? <p role="status" className={styles.success}>Cerraste sesión. Tu tarjeta y tus sellos siguen guardados.</p> : null}
            {desactivada ? <p role="status" className={styles.success}>Tu tarjeta quedó desactivada. Puedes volver a entrar para reactivarla.</p> : null}

            <div className={styles.formBody}>
              {session.status === "not_configured" ? (
                <p role="alert" className={styles.unavailable}><strong>Integración no configurada.</strong> Este entorno no tiene conexión con el servicio de tarjetas.</p>
              ) : disabled ? <ReactivateAccount /> : completing ? (
                <>
                  <ProfileForm contactLabel={session.contact} />
                  <form action={customerSignOutAction} className={styles.changeContact}>
                    <button type="submit">No soy yo · usar otro correo</button>
                  </form>
                </>
              ) : <AccessFlow phoneEnabled={PHONE_AUTH_ENABLED} />}
            </div>
            {!disabled && !completing && session.status !== "not_configured" ? (
              <p className={styles.formFoot}>Al continuar, podrás revisar el <Link href="/privacidad">aviso de privacidad</Link> antes de crear tu tarjeta.</p>
            ) : null}
          </div>
          <div className={styles.belowForm}>
            <p><span aria-hidden="true">⌁</span> Acceso seguro con código de un solo uso</p>
            <p>¿Trabajas en Café Nómada? <Link href="/entrar">Acceso del personal ↗</Link></p>
          </div>
        </section>
      </div>
      <footer className={styles.footer}>Una experiencia de fidelidad impulsada por <a href="https://iautomexa.com">iautomexa</a></footer>
    </main>
  );
}
