# Datos personales: minimización, retención y eliminación

> Borrador técnico. Debe revisarlo quien sea responsable legal de Café Nómada / iautomexa conforme a la LFPDPPP antes del piloto, incluido el aviso de privacidad.

## Qué se guarda
- **Un** canal de contacto verificado: correo **o** teléfono (nunca ambos; si Auth tiene los dos, se guarda solo el correo).
- Nombre corto opcional (máx. 40 caracteres) para que el barista salude.
- Folio de ticket solo como HMAC-SHA256 con pepper secreto (no reversible sin el secreto).
- Historial de sellos y canjes.
- Día y mes de cumpleaños solo si hay consentimiento promocional separado; no se solicita el año.
- Si el cliente desactiva su cuenta: motivo escrito (máximo 200 caracteres), categoría y fecha. El propietario puede verlo hasta que la cuenta se reactive o se elimine.

## Qué no se guarda
Año de nacimiento, dirección, datos de pago ni montos personales en el QR. El QR no contiene nombre, teléfono ni correo.

## Quién ve qué
| Rol | Ve |
|---|---|
| Cliente | Su tarjeta e historial (sin actores ni hashes) |
| Barista | Nombre corto, contacto enmascarado (`•••• 4567`, `a•••@dominio`) y progreso, solo al escanear |
| Gerente | Ledger y compras de sus sucursales |
| Admin/owner | Clientes y auditoría de su empresa |

## Retención propuesta
- Tokens QR: eliminar 24 h después de caducar.
- Ventanas de rate limit: eliminar a las 24 h.
- Ledger y auditoría: 24 meses (prevención de fraude y aclaraciones); después, agregar o anonimizar.
- Cuentas inactivas: aviso a los 18 meses sin actividad; anonimización a los 24.

## Desactivación y eliminación a solicitud
El cliente puede desactivar temporalmente su tarjeta desde `/tarjeta`: se bloquean los QR, se conserva el saldo y puede reactivarla tras volver a verificar su acceso y aceptar el aviso. El motivo libre es visible solo para él y owner/admin y se borra al reactivar.

Si elige eliminación definitiva, se anonimiza el cliente (`status = 'deleted'`, contacto, nombre y motivo libre en `null`, `auth_user_id` desvinculado) y se solicita borrar su usuario de Supabase Auth, salvo que también sea personal. Se conserva solo una categoría de motivo no identificable. El ledger se conserva sin PII para mantener la integridad contable. El aviso y los plazos de retención siguen sujetos a revisión legal antes del piloto.
