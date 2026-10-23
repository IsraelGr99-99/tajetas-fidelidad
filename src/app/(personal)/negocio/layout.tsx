import Link from "next/link";
import { requireCapability } from "@/lib/staff/session";

const SECTIONS = [
  { href: "/personal/admin", label: "Resumen" },
  { href: "/personal/admin/catalogo", label: "Catálogo" },
  { href: "/personal/admin/campana", label: "Campaña" },
  { href: "/personal/admin/personal", label: "Personal" },
  { href: "/personal/admin/sucursales", label: "Sucursales" },
  { href: "/personal/admin/clientes", label: "Clientes" },
];

/** Administración: solo owner y admin. Cada página y acción vuelve a validar. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireCapability("manage_staff");
  return (
    <div className="space-y-8">
      <nav aria-label="Administración" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          {SECTIONS.map((s) => (
            <li key={s.href}>
              <Link href={s.href} className="inline-flex min-h-10 items-center rounded-full border border-tabaco/20 bg-papel px-4 text-sm font-semibold text-tabaco hover:border-tabaco">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
