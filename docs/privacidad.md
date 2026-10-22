# Datos personales: minimización, retención y eliminación

> Borrador técnico. Debe revisarlo quien sea responsable legal de Café Nómada / iautomexa conforme a la LFPDPPP antes del piloto, incluido el aviso de privacidad.

## Qué se guarda
- **Un** canal de contacto verificado: correo **o** teléfono (nunca ambos; si Auth tiene los dos, se guarda solo el correo).
- Nombre corto opcional (máx. 40 caracteres) para que el barista salude.
- Folio de ticket solo como HMAC-SHA256 con pepper secreto (no reversible sin el secreto).
- Historial de sellos y canjes.

## Qué no se guarda
Fecha de nacimiento, dirección, datos de pago ni montos personales en el QR. El QR no contiene nombre, teléfono, correo ni puntos.

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

## Eliminación a solicitud
Se anonimiza el cliente (`status = 'deleted'`, contacto y nombre en `null`, `auth_user_id` desvinculado) y se borra el usuario de Supabase Auth. El ledger se conserva sin PII para mantener la integridad contable. La función de eliminación se implementará en la etapa 5.
