import { SectionTabs } from "@/components/staff/SectionTabs";
import { requireCapability } from "@/lib/staff/session";

const TABS = [
  { href: "/negocio", label: "Panel", exact: true },
  { href: "/negocio/finanzas", label: "Ventas y gastos" },
  { href: "/negocio/catalogo", label: "Catálogo" },
  { href: "/negocio/inventario", label: "Inventario" },
  { href: "/negocio/ventas", label: "Ventas de caja" },
  { href: "/negocio/programa", label: "Programa" },
  { href: "/negocio/equipo", label: "Equipo" },
  { href: "/negocio/clientes", label: "Clientes" },
];

/** Negocio: solo owner y admin. Cada página y acción vuelve a validar. */
export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  await requireCapability("manage_staff");
  return (
    <div className="space-y-8">
      <SectionTabs tabs={TABS} label="Secciones del negocio" />
      {children}
    </div>
  );
}
