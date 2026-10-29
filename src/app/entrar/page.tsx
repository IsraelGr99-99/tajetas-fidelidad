import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/domain/staff/routes";
import { getStaffSession } from "@/lib/staff/session";
import { ProductScreen } from "@/components/marketing/ProductScreen";
import { LoginForm } from "./LoginForm";
import styles from "./entrar.module.css";

export const metadata: Metadata = { title: "Acceso al negocio | iautomexa Loyalty" };

const IAUTOMEXA = "https://iautomexa.com/";
const CONTACT = "https://iautomexa.com/contacto/";

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ siguiente?: string; salida?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.siguiente);
  const session = await getStaffSession();
  if (session.status === "staff") redirect(next);

  return <div className={`${styles.page} console-shell`}>
    <div className={styles.aurora} aria-hidden="true"><i /><i /><i /></div>

    <header className={styles.header}>
      <Link href="/" aria-label="iautomexa Loyalty, ir al inicio" className={styles.logo}><span aria-hidden="true">✳</span><strong>Loyalty<i>.</i></strong></Link>
      <a href={IAUTOMEXA} className={styles.brandPill}><span aria-hidden="true">✳</span>Una tecnología de <strong>iautomexa</strong> <em aria-hidden="true">↗</em></a>
      <div className={styles.headerActions}>
        <a href={CONTACT} className={styles.helpLink}>Ayuda</a>
        <a href={CONTACT} className={styles.headerCta}>Solicitar demo guiada <span aria-hidden="true">↗</span></a>
      </div>
    </header>

    <main id="contenido" className={styles.layout}>
      <section className={styles.formSide} aria-labelledby="login-title">
        <div className={styles.card}>
          <p className={styles.eyebrow}><span aria-hidden="true" />Acceso al negocio</p>
          <h1 id="login-title">Entra a Loyalty</h1>
          <p className={styles.intro}>Para propietarios y personal autorizado. Usa el correo con el que te dieron de alta.</p>
          {params.salida && <p role="status" className={styles.notice}><span aria-hidden="true">✓</span>Cerraste sesión correctamente.</p>}
          <div className={styles.formFrame}>
            {session.status === "not_configured"
              ? <p role="alert" className={styles.unavailable}><strong>Acceso no disponible.</strong> Este entorno todavía no tiene conexión con Supabase.</p>
              : <LoginForm next={next} />}
          </div>
        </div>
        <Link href="/tarjeta/acceso" className={styles.customerLink}>
          <span><strong>¿Eres cliente?</strong> Este acceso es para el personal del negocio.</span>
          <span className={styles.customerCta}>Abrir mi tarjeta de cliente <span aria-hidden="true">→</span></span>
        </Link>
        <p className={styles.help}>¿Aún no tienes cuenta? Pide una invitación al administrador de tu negocio. Para contratar Loyalty, <a href={CONTACT}>solicita una demo guiada a iautomexa</a>.</p>
      </section>

      <section className={styles.story} aria-label="Sobre Loyalty">
        <p className={styles.storyEyebrow}>Consola para negocios</p>
        <p className={styles.headline}>Mucho más que lealtad. <em>Todo tu negocio, conectado.</em></p>
        <p className={styles.lead}>Caja, productos, inventario, reportes y fidelidad para una o muchas sucursales, con cada persona en su rol.</p>
        <figure className={styles.stage} aria-label="Vista ilustrativa del panel con datos de ejemplo">
          <div className={styles.device}><ProductScreen kind="dashboard" locale="es" /></div>
          <ul className={styles.chips} aria-hidden="true">
            <li className={styles.chipA}><b>✓</b>Venta registrada</li>
            <li className={styles.chipB}><b>✓</b>+1 visita en la tarjeta</li>
            <li className={styles.chipC}><b>✓</b>Inventario actualizado</li>
          </ul>
          <figcaption>Vista ilustrativa · datos de ejemplo</figcaption>
        </figure>
        <ul className={styles.assurances} aria-label="Seguridad del acceso">
          <li>Acceso individual por persona</li>
          <li>Verificación en dos pasos</li>
          <li>Historial auditable</li>
        </ul>
      </section>
    </main>

    <footer className={styles.footer}>
      <span>© {new Date().getFullYear()} iautomexa · Loyalty</span>
      <nav aria-label="Enlaces del pie">
        <a href={IAUTOMEXA}>iautomexa.com ↗</a>
        <a href={CONTACT}>Contacto ↗</a>
        <Link href="/privacidad">Privacidad</Link>
        <Link href="/" className={styles.footerHome}>Conocer Loyalty →</Link>
      </nav>
    </footer>
  </div>;
}
