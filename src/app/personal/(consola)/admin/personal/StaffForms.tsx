"use client";

import { useActionState, useState } from "react";
import { type ActionState, inviteStaffAction, revokeInvitationAction, updateStaffAction } from "@/app/personal/gestion";
import { FormMessage } from "@/components/ui/FormMessage";
import { errorTextClass, hintClass, inputClass, labelClass } from "@/components/ui/form";
import { ROLE_LABELS, type StaffRole } from "@/domain/staff/permissions";

type Branch = { id: string; name: string };
const idle: ActionState = { ok: false, message: null };

function RoleAndBranches({
  uid,
  roles,
  branches,
  defaultRole,
  defaultBranchIds,
}: {
  uid: string;
  roles: StaffRole[];
  branches: Branch[];
  defaultRole: StaffRole;
  defaultBranchIds: string[];
}) {
  const [role, setRole] = useState<StaffRole>(defaultRole);
  const needsBranches = role === "manager" || role === "barista";
  return (
    <>
      <div>
        <label htmlFor={`${uid}-role`} className={labelClass}>
          Rol
        </label>
        <select id={`${uid}-role`} name="role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)} className={inputClass}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>
      {needsBranches ? (
        <fieldset>
          <legend className={labelClass}>Sucursales donde opera</legend>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-tabaco">
            {branches.map((b) => (
              <label key={b.id} className="flex items-center gap-2">
                <input type="checkbox" name="branchIds" value={b.id} defaultChecked={defaultBranchIds.includes(b.id)} className="h-5 w-5 accent-[#3d2c24]" />
                {b.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className={hintClass}>{ROLE_LABELS[role]} opera en todas las sucursales.</p>
      )}
    </>
  );
}

export function InviteForm({ roles, branches }: { roles: StaffRole[]; branches: Branch[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(inviteStaffAction, idle);
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="inv-name" className={labelClass}>
            Nombre
          </label>
          <input id="inv-name" name="displayName" required maxLength={80} className={inputClass} />
          {err.displayName ? <p className={errorTextClass}>{err.displayName}</p> : null}
        </div>
        <div>
          <label htmlFor="inv-email" className={labelClass}>
            Correo
          </label>
          <input id="inv-email" name="email" type="email" required className={inputClass} />
          {err.email ? <p className={errorTextClass}>{err.email}</p> : null}
        </div>
      </div>
      <RoleAndBranches uid="inv" roles={roles} branches={branches} defaultRole="barista" defaultBranchIds={branches.length === 1 ? [branches[0].id] : []} />
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-oscuro disabled:opacity-70">
        {pending ? "Invitando…" : "Crear invitación"}
      </button>
    </form>
  );
}

export function StaffMemberForm({
  member,
  roles,
  branches,
}: {
  member: { id: string; role: StaffRole; active: boolean; branch_ids: string[] };
  roles: StaffRole[];
  branches: Branch[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateStaffAction, idle);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="staffMemberId" value={member.id} />
      <RoleAndBranches uid={member.id} roles={roles} branches={branches} defaultRole={member.role} defaultBranchIds={member.branch_ids} />
      <label className="flex items-center gap-2 text-sm text-tabaco">
        <input type="checkbox" name="active" defaultChecked={member.active} className="h-5 w-5 accent-[#3d2c24]" /> Activo (al desactivarlo pierde
        el acceso de inmediato)
      </label>
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn btn-oscuro disabled:opacity-70">
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(revokeInvitationAction, idle);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="invitationId" value={invitationId} />
      <button type="submit" disabled={pending} className="text-sm font-semibold text-arcilla-texto underline underline-offset-4 disabled:opacity-60">
        {pending ? "Revocando…" : "Revocar"}
      </button>
      {state.message && !state.ok ? <span className="text-xs text-alerta">{state.message}</span> : null}
    </form>
  );
}
