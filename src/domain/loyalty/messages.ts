/**
 * Mensajes en español para los códigos de rechazo de las RPC
 * (ver docs/arquitectura.md). Nunca exponen detalles internos.
 */
export const RPC_ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: "Tu sesión terminó. Vuelve a iniciar sesión.",
  forbidden: "No tienes permiso para hacer esto en esta sucursal.",
  not_found: "No encontramos ese registro.",
  invalid_request: "Revisa los datos e inténtalo de nuevo.",
  invalid_items: "Algún producto no es válido o la cantidad no es correcta.",
  idempotency_conflict: "Esta operación ya se registró con otros datos. Empieza de nuevo.",
  rate_limited: "Demasiados intentos seguidos. Espera unos minutos.",
  token_invalid: "El código QR ya se usó o caducó. Pide al cliente que muestre uno nuevo.",
  nfc_invalid: "El sello NFC no corresponde a esta sucursal.",
  card_not_found: "No encontramos esa tarjeta.",
  card_inactive: "Esta tarjeta está desactivada.",
  no_active_campaign: "No hay un programa de fidelidad activo.",
  duplicate_purchase: "Ese ticket ya acumuló un sello.",
  not_eligible: "Esta compra no incluye productos que acumulen sellos.",
  too_soon: "Esta tarjeta acaba de recibir un sello. Espera unos minutos.",
  daily_limit: "Esta tarjeta ya alcanzó el máximo de sellos de hoy.",
  no_reward_available: "No hay recompensas disponibles para canjear.",
  not_reversible: "Este movimiento no se puede revertir.",
  already_reversed: "Este movimiento ya se revirtió.",
  requires_manual_review: "No se puede revertir automáticamente: la recompensa ya se canjeó. Pide a administración un ajuste manual.",
  would_go_negative: "El ajuste dejaría la tarjeta con saldo negativo.",
  invalid_rules: "La regla del programa no es válida.",
  contact_not_verified: "Primero verifica tu correo o teléfono con el código.",
  contact_already_enrolled: "Ese correo o teléfono ya tiene una tarjeta. Inicia sesión con él.",
  business_not_found: "No encontramos la cafetería.",
  not_enrolled: "Aún no tienes tarjeta.",
  duplicate_name: "Ya existe un registro con ese nombre.",
  last_active_branch: "Debe quedar al menos una sucursal activa.",
  branch_required: "Asigna al menos una sucursal.",
  staff_exists: "Esa persona ya forma parte del personal.",
  invitation_exists: "Ya hay una invitación pendiente para ese correo.",
  invitation_closed: "Esa invitación ya fue aceptada o revocada.",
  cannot_modify_self: "No puedes cambiar tu propio rol o estado. Pídeselo a otra persona con permisos.",
  last_owner: "Debe quedar al menos un propietario activo.",
};

export function rpcErrorMessage(code: unknown): string {
  return (typeof code === "string" && RPC_ERROR_MESSAGES[code]) || "Algo salió mal. Inténtalo de nuevo en un momento.";
}
