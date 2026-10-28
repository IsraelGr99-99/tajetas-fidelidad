import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { Notice } from "@/components/staff/OperationParts";
import { SectionNav } from "@/components/staff/SectionNav";
import { rpcErrorMessage } from "@/domain/loyalty/messages";
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/domain/staff/permissions";
import { formatDate } from "@/lib/format";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BranchesSection } from "./BranchesSection";
import { InviteForm, RevokeInvitationButton, StaffMemberForm } from "./StaffForms";

export const metadata: Metadata = { title: "Equipo" };

const listSchema = z.object({
  ok: z.literal(true),
  members: z.array(
    z.object({
      id: z.uuid(),
      display_name: z.string(),
      role: z.enum(STAFF_ROLES),
      active: z.boolean(),
      is_self: z.boolean(),
      email: z.string(),
      branch_ids: z.array(z.uuid()),
      manageable: z.boolean(),
    }),
  ),
  invitations: z.array(
    z.object({
      id: z.uuid(),
      email: z.string(),
      display_name: z.string(),
      role: z.enum(STAFF_ROLES),
      branch_ids: z.array(z.uuid()),
      created_at: z.string(),
      manageable: z.boolean(),
    }),
  ),
});

export default async function StaffAdminPage({ searchParams }: { searchParams: Promise<{ sucursal?: string }> }) {
  const { membership } = await requireCapability("manage_staff");
  const requestedBranch = (await searchParams).sucursal;
  const supabase = await createSupabaseServerClient();
  const [list, branchesRes] = await Promise.all([
    supabase?.rpc("list_staff", { p_business_id: membership.business_id }),
    supabase?.from("branches").select("id, name").eq("business_id", membership.business_id).eq("active", true).order("name"),
  ]);
  const parsed = listSchema.safeParse(list?.data);
  const branches = (branchesRes?.data ?? []) as { id: string; name: string }[];
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const selectedBranch = branches.find((branch) => branch.id === requestedBranch)?.id ?? null;
  const members = parsed.success ? parsed.data.members.filter((member) => !selectedBranch || member.role === "owner" || member.role === "admin" || member.branch_ids.includes(selectedBranch)) : [];
  const invitations = parsed.success ? parsed.data.invitations.filter((invite) => !selectedBranch || invite.role === "owner" || invite.role === "admin" || invite.branch_ids.includes(selectedBranch)) : [];
  // Owner gestiona todos los roles; admin solo gerencia y baristas (la base lo vuelve a validar).
  const assignable: StaffRole[] = membership.role === "owner" ? [...STAFF_ROLES] : ["manager", "barista"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl text-tabaco">Equipo</h1>
        <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
          Invita por correo: la persona entra en <strong>/entrar</strong> con “Código por correo” y la invitación se acepta sola. Nadie comparte
          contraseñas.
        </p>
      </div>

      <SectionNav label="Secciones de equipo y sucursales" items={[{ href: "#invitar", label: "Invitar personal" }, { href: "#equipo", label: "Equipo" }, { href: "#sucursales", label: "Sucursales" }]} />

      {!parsed.success ? <Notice tone="error" title={rpcErrorMessage((list?.data as { code?: string } | null)?.code)} /> : null}

      <nav aria-label="Filtrar equipo por sucursal" className="workspace-card p-4"><p className="mb-3 text-sm font-bold text-slate-800">Sucursal que estás viendo</p><div className="flex flex-wrap gap-2 text-sm">
        <Link href="/negocio/equipo" aria-current={!selectedBranch ? "page" : undefined} className={`rounded-xl border px-4 py-2 font-semibold ${!selectedBranch ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200 text-slate-700 hover:bg-blue-50"}`}>Todo el equipo</Link>
        {branches.map((branch) => <Link key={branch.id} href={`/negocio/equipo?sucursal=${branch.id}`} aria-current={selectedBranch === branch.id ? "page" : undefined} className={`rounded-xl border px-4 py-2 font-semibold ${selectedBranch === branch.id ? "border-blue-700 bg-blue-700 text-white" : "border-slate-200 text-slate-700 hover:bg-blue-50"}`}>{branch.name}</Link>)}
      </div></nav>

      <section id="invitar" aria-labelledby="invitar-title" className="scroll-mt-24 rounded-3xl bg-papel p-6">
        <h2 id="invitar-title" className="text-2xl text-tabaco">
          Invitar a alguien
        </h2>
        <div className="mt-4">
          <InviteForm roles={assignable} branches={branches} />
        </div>
      </section>

      {parsed.success && invitations.length > 0 ? (
        <section aria-labelledby="pendientes">
          <h2 id="pendientes" className="text-2xl text-tabaco">
            Invitaciones pendientes
          </h2>
          <ul className="mt-4 divide-y divide-tabaco/10 rounded-3xl bg-papel">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold text-tabaco">
                    {i.display_name} · {ROLE_LABELS[i.role]}
                  </p>
                  <p className="text-sm text-tabaco/75">
                    {i.email} · desde {formatDate(i.created_at)}
                    {i.branch_ids.length ? ` · ${i.branch_ids.map((b) => branchName.get(b) ?? "—").join(", ")}` : ""}
                  </p>
                </div>
                {i.manageable ? <RevokeInvitationButton invitationId={i.id} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {parsed.success ? (
        <section id="equipo" aria-labelledby="equipo-title" className="scroll-mt-24">
          <h2 id="equipo-title" className="text-2xl text-tabaco">
            Equipo ({members.length})
          </h2>
          <ul className="mt-4 space-y-3">
            {members.map((m) => (
              <li key={m.id} className={`rounded-2xl border border-tabaco/10 bg-papel ${m.active ? "" : "opacity-75"}`}>
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-4">
                    <span>
                      <span className="font-semibold text-tabaco">
                        {m.display_name}
                        {m.is_self ? " (tú)" : ""}
                      </span>
                      <span className="block text-sm text-tabaco/75">
                        {ROLE_LABELS[m.role]} · {m.email} · {m.active ? "activo" : "inactivo"}
                        {m.branch_ids.length ? ` · ${m.branch_ids.map((b) => branchName.get(b) ?? "—").join(", ")}` : ""}
                      </span>
                    </span>
                    {m.manageable ? <span className="text-sm font-semibold text-arcilla-texto underline underline-offset-4">Editar</span> : null}
                  </summary>
                  {m.manageable ? (
                    <div className="border-t border-tabaco/10 p-4">
                      <StaffMemberForm member={m} roles={assignable} branches={branches} />
                    </div>
                  ) : (
                    <p className="border-t border-tabaco/10 p-4 text-sm text-tabaco/75">
                      {m.is_self ? "No puedes cambiar tu propio rol o estado." : "Solo el propietario puede cambiar este rol."}
                    </p>
                  )}
                </details>
              </li>
            ))}
          </ul>
          {members.length === 0 && <p className="mt-3 text-sm text-slate-600">No hay integrantes asignados a esta sucursal.</p>}
        </section>
      ) : null}
      <div id="sucursales" className="scroll-mt-24"><BranchesSection /></div>
    </div>
  );
}
