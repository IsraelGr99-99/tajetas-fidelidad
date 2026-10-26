import { requireCapability } from "@/lib/staff/session";

/** Negocio: solo owner y admin. Cada página y acción vuelve a validar. */
export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  await requireCapability("manage_staff");
  return <div className="space-y-8">{children}</div>;
}
