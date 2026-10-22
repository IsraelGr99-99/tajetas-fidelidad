# Sello físico NFC (Bambu Lab A1 mini)

## Propuesta de pieza
- Carcasa tipo tampón de ~45 mm de diámetro × 18 mm de alto, impresa en PLA o PETG (PETG resiste mejor el calor de la barra).
- Cavidad para etiqueta NFC de ~25 mm. **Medir la etiqueta real** (diámetro y grosor, normalmente 0.3–1 mm con adhesivo) antes del diseño final; dejar 0.3 mm de holgura.
- Tapa inferior a presión o pegada; el tag queda a ≤2 mm de la superficie superior para una lectura fiable. Evitar metal cerca (degrada la lectura).
- Grabar en relieve el imagotipo y “Acerca tu teléfono”.

## Contenido de la etiqueta (piloto: NTAG213/215)
- Registro NDEF URI: `https://fidelidad-demo.iautomexa.com/s/<public_id>`; `public_id` aleatorio de 22–64 caracteres `[A-Za-z0-9_-]` (tabla `nfc_devices`).
- Sin datos personales, saldo ni secreto.
- Bloquear la etiqueta como solo lectura después de escribirla y verificarla.

## Modelo de seguridad
El identificador **no es secreto** y puede copiarse. Solo indica “este sello pertenece a la sucursal X”. Una acreditación exige además:
1. Empleado autenticado con acceso a esa sucursal.
2. QR temporal de un solo uso del cliente.
3. Compra válida con folio único y partidas del catálogo.
4. Autorización del servidor (frecuencia, máximo diario, idempotencia).

Un sello NFC de otra sucursal o desactivado produce `nfc_invalid`. Clonar la etiqueta no da sellos.

## Producción: etiqueta criptográfica
Para resistir mejor la clonación se puede usar **NTAG 424 DNA** con SUN/SDM: cada lectura genera una URL con contador y CMAC (AES-128) que el servidor verifica, y rechaza contadores repetidos. Requiere guardar llaves por etiqueta en el gestor de secretos y un proceso de personalización.

Limitaciones: un tag criptográfico reduce el clonado, pero **no elimina** los ataques de relay (reenviar la lectura en tiempo real) y su eficacia depende de la implementación. No se afirma resistencia total hasta probar el hardware y el protocolo.
