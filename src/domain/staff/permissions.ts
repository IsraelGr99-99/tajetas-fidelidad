import { z } from "zod";

/**
 * Roles y capacidades del personal. Refleja las reglas de las funciones SQL
 * (`supabase/migrations`) solo para decidir qué mostrar en la UI; la base de
 * datos vuelve a validar cada operación.
 */
export const STAFF_ROLES = ["owner", "admin", "manager", "barista"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Propietario",
  admin: "Administración",
  manager: "Gerencia",
  barista: "Barista",
};

export type Capability =
  | "earn_with_qr"
  | "earn_without_qr"
  | "redeem"
  | "reverse"
  | "adjust_stamps"
  | "manage_campaigns"
  | "manage_staff"
  | "view_customers_pii"
  | "view_branch_ledger"
  | "view_audit_log";

const CAPABILITIES: Record<StaffRole, readonly Capability[]> = {
  barista: ["earn_with_qr", "redeem"],
  manager: ["earn_with_qr", "earn_without_qr", "redeem", "reverse", "view_branch_ledger"],
  admin: [
    "earn_with_qr", "earn_without_qr", "redeem", "reverse", "adjust_stamps",
    "manage_campaigns", "manage_staff", "view_customers_pii", "view_branch_ledger", "view_audit_log",
  ],
  owner: [
    "earn_with_qr", "earn_without_qr", "redeem", "reverse", "adjust_stamps",
    "manage_campaigns", "manage_staff", "view_customers_pii", "view_branch_ledger", "view_audit_log",
  ],
};

export function can(role: StaffRole, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability);
}

export function capabilitiesOf(role: StaffRole): readonly Capability[] {
  return CAPABILITIES[role];
}

// ---------------------------------------------------------------------
// Contrato de `get_staff_context()` (se valida la respuesta del servidor)
// ---------------------------------------------------------------------
export const branchSchema = z.object({ id: z.uuid(), slug: z.string(), name: z.string() });

export const membershipSchema = z.object({
  staff_member_id: z.uuid(),
  display_name: z.string(),
  role: z.enum(STAFF_ROLES),
  business_id: z.uuid(),
  business_slug: z.string(),
  business_name: z.string(),
  is_demo: z.boolean(),
  /** Owner/admin con verificación en dos pasos activada pero sin completarla en esta sesión. */
  mfa_pending: z.boolean().default(false),
  branches: z.array(branchSchema),
});

export const staffContextSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), memberships: z.array(membershipSchema) }),
  z.object({ ok: z.literal(false), code: z.string() }),
]);

export type Branch = z.infer<typeof branchSchema>;
export type Membership = z.infer<typeof membershipSchema>;

/**
 * Elige la sucursal activa: la guardada en la cookie si sigue siendo válida;
 * si el usuario solo opera una, esa; si no, ninguna (debe elegir).
 */
export function resolveActiveBranch(membership: Membership, requestedBranchId: string | undefined): Branch | null {
  if (requestedBranchId) {
    const match = membership.branches.find((b) => b.id === requestedBranchId);
    if (match) return match;
  }
  return membership.branches.length === 1 ? membership.branches[0] : null;
}
