import { expect, test } from "vitest";
import { captchaFailedMessage, captchaReason } from "./auth-errors";

test("extrae el motivo de Cloudflare del mensaje de Supabase", () => {
  expect(captchaReason("captcha protection: request disallowed (invalid-input-response)")).toBe("invalid-input-response");
  expect(captchaReason("captcha protection: request disallowed (timeout-or-duplicate)")).toBe("timeout-or-duplicate");
  expect(captchaReason("otro error")).toBeNull();
  expect(captchaFailedMessage("captcha protection: request disallowed (invalid-input-response)")).toContain("mismo widget");
});
