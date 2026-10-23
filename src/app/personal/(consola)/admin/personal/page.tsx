import type { Metadata } from "next";
import { z } from "zod";
import { Notice } from "@/components/staff/OperationParts";
import { rpcErrorMessage } from "@/domain/loyalty/messages";
import { ROLE_LABELS, STAFF_ROLES, type StaffRole } from "@/domain/staff/permissions";
import { formatDate } from "@/lib/format";
import { requireCapability } from "@/lib/staff/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { InviteForm, RevokeInvitationButton, StaffMemberForm } from "./StaffForms";

export const metadata: Metadata = { title: "Personal" };

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

export default async function StaffAdminPage() {
  const { membership } = await requireCapability("manage_staff");
  const supabase = await createSupabaseServerClient();
  const [list, branchesRes] = await Promise.all([
    supabase?.rpc("list_staff", { p_business_id: membership.business_id }),
    supabase?.from("branches").select("id, name").eq("business_id", membership.business_id).eq("active", true).order("name"),
  ]);
  const parsed = listSchema.safeParse(list?.data);
  const branches = (branchesRes?.data ?? []) as { id: string; name: string }[];
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  // Owner gestiona todos los roles; admin solo gerencia y baristas (la base lo vuelve a validar).
  const assignable: StaffRole[] = membership.role === "owner" ? [...STAFF_ROLES] : ["manager", "barista"];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl text-tabaco">Personal</h1>
        <p className="mt-2 max-w-2xl leading-7 text-tabaco/75">
          Invita por correo: la persona entra en <strong>/personal/ingresar</strong> con “código por correo” y la invitación se acepta sola. Nadie
          comparte contraseñas.
        </p>
      </div>

      {!parsed.success ? <Notice tone="error" title={rpcErrorMessage((list?.data as { code?: string } | null)?.code)} /> : null}

      <section aria-labelledby="invitar" className="rounded-3xl bg-papel p-6">
        <h2 id="invitar" className="text-2xl text-tabaco">
          Invitar a alguien
        </h2>
        <div className="mt-4">
          <InviteForm roles={assignable} branches={branches} />
        </div>
      </section>

      {parsed.success && parsed.data.invitations.length > 0 ? (
        <section aria-labelledby="pendientes">
          <h2 id="pendientes" className="text-2xl text-tabaco">
            Invitaciones pendientes
          </h2>
          <ul className="mt-4 divide-y divide-tabaco/10 rounded-3xl bg-papel">
            {parsed.data.invitations.map((i) => (
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
        <section aria-labelledby="equipo">
          <h2 id="equipo" className="text-2xl text-tabaco">
            Equipo ({parsed.data.members.length})
          </h2>
          <ul className="mt-4 space-y-3">
            {parsed.data.members.map((m) => (
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
        </section>
      ) : null}
    </div>
  );
}
