import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/domain/staff/routes";
import { getStaffSession } from "@/lib/staff/session";
import { LoginForm } from "./LoginForm";
import styles from "./entrar.module.css";

export const metadata: Metadata = { title: "Acceso al negocio | iautomexa Loyalty" };

export default async function StaffLoginPage({ searchParams }: { searchParams: Promise<{ siguiente?: string; salida?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.siguiente);
  const session = await getStaffSession();
  if (session.status === "staff") redirect(next);

  return <main id="contenido" className={`${styles.page} console-shell`}>
    <section className={styles.story} aria-label="Sobre Loyalty">
      <Link href="/" aria-label="iautomexa Loyalty, ir al inicio" className={styles.brand}><span aria-hidden="true">✳</span><strong>Loyalty.</strong></Link>
      <div className={styles.storyBody}>
        <p className={styles.eyebrow}>TECNOLOGÍA DE IAUTOMEXA</p>
        <p className={styles.storyHeadline}>Cada venta cuenta.<br /><em>Cada cliente también.</em></p>
        <p className={styles.storyText}>Caja, inventario y fidelidad conectados para que veas lo importante y tu equipo sepa qué hacer.</p>
        <div className={styles.storyFlow} aria-label="Áreas conectadas de Loyalty"><span>01 / Caja</span><span>02 / Inventario</span><span>03 / Fidelidad</span></div>
      </div>
      <p className={styles.storyFoot}>Un espacio para propietarios y personal autorizado.</p>
    </section>
    <section className={styles.formSide} aria-labelledby="login-title">
      <div className={styles.formTop}><Link href="/" className={styles.mobileBrand} aria-label="iautomexa Loyalty, ir al inicio"><span aria-hidden="true">✳</span> Loyalty.</Link><span>ACCESO AL NEGOCIO</span></div>
      <div className={styles.formContent}>
        <p className={styles.eyebrow}>BIENVENIDO A TU NEGOCIO</p>
        <h1 id="login-title">Entra a Loyalty</h1>
        <p className={styles.formIntro}>Usa el correo de tu equipo. Si recibiste una invitación, elige “Código por correo”.</p>
        {params.salida && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Cerraste sesión correctamente.</p>}
        <div className={styles.formFrame}>{session.status === "not_configured" ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-950"><strong>Acceso no disponible.</strong> Este entorno todavía no tiene conexión con Supabase.</p> : <LoginForm next={next} />}</div>
        <p className={styles.formHelp}>Este acceso es solo para personal autorizado. Si necesitas una cuenta, solicita una invitación al administrador de tu negocio.</p>
      </div>
      <div className={styles.formFoot}><span>© iautomexa Loyalty</span><Link href="/">Conocer Loyalty →</Link></div>
    </section>
  </main>;
}
