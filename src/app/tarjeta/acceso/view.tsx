import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/Logo";
import { PassportCard } from "@/components/loyalty/PassportCard";
import { PILOT_CAMPAIGN } from "@/domain/loyalty/campaign";
import { DEFAULT_CARD_THEME } from "@/domain/loyalty/branding";
import { customerPaths } from "@/domain/customer/business-route";
import { PHONE_AUTH_ENABLED, PILOT_BUSINESS_SLUG } from "@/lib/business";
import { getCustomerBusiness } from "@/lib/customer/business";
import { customerEnrollmentOpen } from "@/lib/customer/availability";
import { getCustomerSession } from "@/lib/customer/session";
import { customerSignOutAction } from "../actions";
import { AccessFlow } from "./AccessFlow";
import { ProfileForm } from "./ProfileForm";
import { ReactivateAccount } from "./ReactivateAccount";
import styles from "./page.module.css";

export async function CustomerAccessView({ businessSlug, searchParams }: { businessSlug: string; searchParams: Promise<{ salida?: string; eliminada?: string; desactivada?: string }> }) {
  const { salida, eliminada, desactivada } = await searchParams;
  const isPilot = businessSlug === PILOT_BUSINESS_SLUG;
  const [session, theme] = await Promise.all([getCustomerSession(businessSlug), isPilot ? DEFAULT_CARD_THEME : getCustomerBusiness(businessSlug)]);
  const paths = customerPaths(businessSlug);
  const enrollmentOpen = customerEnrollmentOpen(businessSlug);
  if (session.status === "enrolled") redirect(paths.card);

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
          <Link href={paths.home} className={styles.brand} aria-label={`${theme.businessName}, ir al inicio`}>{isPilot ? <Wordmark /> : <span className="font-bold text-slate-950">{theme.businessName}</span>}</Link>
          <Link href={paths.home} className={styles.back}>← <span>Conocer el programa</span></Link>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.story} aria-labelledby="story-title">
          <div className={styles.storyInner}>
            <p className={styles.storyKicker}><span aria-hidden="true">✳</span> {theme.businessName.toLocaleUpperCase("es-MX")} · FIDELIDAD</p>
            <h2 id="story-title">Cada visita tiene<br /><em>algo de regreso.</em></h2>
            <p className={styles.storyCopy}>Lleva tus sellos contigo, sigue tu avance y disfruta tu próxima recompensa.</p>
            <div className={styles.storyCard}>
              <PassportCard
                sample
                stampsBalance={4}
                stampsRequired={isPilot ? PILOT_CAMPAIGN.stampsRequired : 5}
                rewardsAvailable={0}
                rewardDescription={isPilot ? PILOT_CAMPAIGN.rewardDescription : "Tu recompensa"}
                theme={theme}
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

            {eliminada ? <p role="status" className={styles.success}>Eliminamos tus datos personales de {theme.businessName}.</p> : null}
            {salida ? <p role="status" className={styles.success}>Cerraste sesión. Tu tarjeta y tus sellos siguen guardados.</p> : null}
            {desactivada ? <p role="status" className={styles.success}>Tu tarjeta quedó desactivada. Puedes volver a entrar para reactivarla.</p> : null}

            <div className={styles.formBody}>
              {session.status === "not_configured" ? (
                <p role="alert" className={styles.unavailable}><strong>Integración no configurada.</strong> Este entorno no tiene conexión con el servicio de tarjetas.</p>
              ) : !enrollmentOpen && !disabled ? (
                <p role="status" className={styles.unavailable}><strong>Acceso público pendiente.</strong> Este negocio está en configuración DEMO. No invites clientes ni captures datos reales hasta publicar su aviso de privacidad y habilitar el registro.</p>
              ) : disabled ? <ReactivateAccount businessSlug={businessSlug} /> : completing ? (
                <>
                  <ProfileForm contactLabel={session.contact} businessSlug={businessSlug} businessName={theme.businessName} />
                  <form action={customerSignOutAction.bind(null, businessSlug)} className={styles.changeContact}>
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
            <p>¿Trabajas en {theme.businessName}? <Link href="/entrar">Acceso del personal ↗</Link></p>
          </div>
        </section>
      </div>
      <footer className={styles.footer}>Una experiencia de fidelidad impulsada por <a href="https://iautomexa.com">iautomexa</a></footer>
    </main>
  );
}
