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

export const otpSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => /^\d{6}$/.test(v), "El código tiene 6 dígitos.");

export const displayNameSchema = z
  .string()
  .trim()
  .max(40, "Máximo 40 caracteres.")
  .refine((v) => !/[<>\p{Cc}]/u.test(v), "Usa solo letras, números y signos comunes.")
  .transform((v) => (v === "" ? null : v));

/** Versión vigente del aviso de privacidad (fecha). Cambiarla obliga a registrar una nueva aceptación. */
export const PRIVACY_VERSION = "2026-10-23";
