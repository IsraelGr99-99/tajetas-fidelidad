import { z } from "zod";

/** Canal elegido por el cliente: uno solo, el que prefiera. */
export type ContactChannel = "email" | "phone";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "El correo es demasiado largo.")
  .pipe(z.email("Escribe un correo válido, por ejemplo nombre@correo.com."));

/**
 * Teléfono móvil de México: 10 dígitos nacionales (con o sin +52 / 52 al inicio).
 * Devuelve E.164 (`+52XXXXXXXXXX`).
 */
export const mxPhoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s().-]/g, ""))
  .transform((v) => v.replace(/^\+?52(1)?(?=\d{10}$)/, ""))
  .refine((v) => /^[2-9]\d{9}$/.test(v), "Escribe tu número a 10 dígitos, por ejemplo 222 123 4567.")
  .transform((v) => `+52${v}`);

/**
 * Código de verificación de Supabase Auth. Su longitud se configura en el proyecto
 * (6 a 10 dígitos; el piloto usa 8), así que la UI no asume un número fijo.
 */
export const OTP_MIN_LENGTH = 6;
export const OTP_MAX_LENGTH = 10;
export const otpSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine(
    (v) => v.length >= OTP_MIN_LENGTH && v.length <= OTP_MAX_LENGTH,
    "Escribe el código completo que te enviamos (solo números).",
  );

export const displayNameSchema = z
  .string()
  .trim()
  .max(40, "Máximo 40 caracteres.")
  .refine((v) => !/[<>\p{Cc}]/u.test(v), "Usa solo letras, números y signos comunes.")
  .transform((v) => (v === "" ? null : v));

/** Versión vigente del aviso de privacidad (fecha). Cambiarla obliga a registrar una nueva aceptación. */
export const PRIVACY_VERSION = "2026-10-23";
