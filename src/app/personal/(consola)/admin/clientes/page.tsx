import type { Metadata } from "next";
import { requireCapability } from "@/lib/staff/session";
import { CustomerSearch } from "./CustomerSearch";

export const metadata: Metadata = { title: "Clientes" };

export default async function CustomersPage() {
  await requireCapability("view_customers_pii");
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl text-tabaco">Clientes</h1>
        <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
          Por privacidad no hay listado general: busca con el dato exacto que te dé el cliente. El contacto se muestra enmascarado y cada búsqueda
          queda registrada (sin el dato buscado).
        </p>
      </div>
      <CustomerSearch />
    </div>
  );
}
