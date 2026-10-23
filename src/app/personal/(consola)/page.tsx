import type { Metadata } from "next";
import Link from "next/link";
import { type Capability, ROLE_LABELS, can } from "@/domain/staff/permissions";
import { requireStaffWithBranch } from "@/lib/staff/session";

export const metadata: Metadata = { title: "Consola" };

const PERMISSION_TEXT: { capability: Capability; text: string }[] = [
  { capability: "earn_with_qr", text: "Registrar visitas con el código QR del cliente" },
  { capability: "redeem", text: "Canjear recompensas con la confirmación del cliente" },
  { capability: "earn_without_qr", text: "Registrar visitas buscando la tarjeta (sin QR)" },
  { capability: "reverse", text: "Revertir visitas y canjes con motivo" },
  { capability: "adjust_stamps", text: "Ajustar sellos manualmente con motivo" },
  { capability: "manage_campaigns", text: "Cambiar la regla del programa" },
  { capability: "manage_staff", text: "Dar de alta y baja al personal" },
  { capability: "view_audit_log", text: "Consultar la bitácora de auditoría" },
];

export default async function ConsoleHomePage() {
  const { membership, activeBranch } = await requireStaffWithBranch();
  const role = membership.role;
  const firstName = membership.display_name.split(" ")[0];

  const tiles = [
    { title: "Registrar visita", body: "Captura el ticket, escanea el QR del cliente y confirma el sello.", show: can(role, "earn_with_qr"), href: "/personal/visita" },
    { title: "Canjear recompensa", body: "El cliente confirma el canje desde su teléfono y tú lo escaneas.", show: can(role, "redeem"), href: "/personal/canje" },
    { title: "Movimientos y reversos", body: "Consulta la bitácora de la sucursal y corrige con motivo.", show: can(role, "view_branch_ledger"), href: "/personal/movimientos" },
    { title: "Administración", body: "Campaña, personal, sucursales y clientes.", show: can(role, "manage_staff"), href: "/personal/admin" },
  ].filter((t) => t.show);

  return (
    <div className="space-y-10">
      <section>
        <p className="bitacora text-arcilla-texto">{activeBranch.name}</p>
        <h1 className="mt-2 text-4xl text-tabaco sm:text-5xl">Buen turno, {firstName}.</h1>
        <p className="mt-3 max-w-2xl leading-7 text-tabaco/75">
          Iniciaste sesión como <strong>{ROLE_LABELS[role]}</strong>. Lo que hagas en esta sucursal queda registrado a tu nombre.
        </p>
      </section>

      <section aria-labelledby="acciones-titulo">
        <h2 id="acciones-titulo" className="sr-only">
          Acciones
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {tiles.map((tile) =>
            tile.href ? (
              <li key={tile.title}>
                <Link
                  href={tile.href}
                  className="block h-full rounded-3xl bg-tabaco p-6 text-crema transition hover:bg-arcilla-texto focus-visible:outline-3 focus-visible:outline-mostaza"
                >
                  <h3 className="text-2xl">{tile.title}</h3>
                  <p className="mt-3 leading-7 text-crema/80">{tile.body}</p>
                  <span aria-hidden="true" className="mt-4 inline-block font-semibold text-mostaza">
                    Empezar →
                  </span>
                </Link>
              </li>
            ) : (
              <li key={tile.title} className="rounded-3xl border border-dashed border-tabaco/25 bg-papel/70 p-6">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-2xl text-tabaco">{tile.title}</h3>
                  <span className="bitacora shrink-0 rounded-full border border-tabaco/25 px-2.5 py-1 text-[0.6rem] text-tabaco/75">Próximamente</span>
                </div>
                <p className="mt-3 leading-7 text-tabaco/75">{tile.body}</p>
              </li>
            ),
          )}
        </ul>
      </section>

      <section aria-labelledby="permisos-titulo" className="rounded-3xl bg-papel p-6 sm:p-8">
        <h2 id="permisos-titulo" className="text-2xl text-tabaco">
          Lo que puedes hacer
        </h2>
        <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {PERMISSION_TEXT.map(({ capability, text }) => {
            const allowed = can(role, capability);
            return (
              <li key={capability} className={`flex gap-3 leading-6 ${allowed ? "text-tabaco" : "text-tabaco/75 line-through decoration-tabaco/40"}`}>
                <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${allowed ? "bg-exito" : "border border-tabaco/40"}`} />
                <span>
                  {text}
                  <span className="sr-only">{allowed ? " (permitido)" : " (no permitido)"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
