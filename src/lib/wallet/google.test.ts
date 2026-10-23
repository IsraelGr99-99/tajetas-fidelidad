import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { buildLoyaltyClass, buildLoyaltyObject, saveUrl, signJwt } = await import("./google");

// Llave de prueba generada al momento (nunca una credencial real).
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const config = {
  issuerId: "3388000000000000000",
  serviceAccount: { client_email: "wallet@proyecto.iam.gserviceaccount.com", private_key: pem, token_uri: "https://oauth2.googleapis.com/token" },
  mode: "demo" as const,
  appUrl: "https://fidelidad-demo.iautomexa.com",
  logoUrl: "https://example.supabase.co/storage/v1/object/public/brand/logo.png",
};

const card = {
  card_id: "c1",
  public_serial: "0123456789abcdef0123456789abcdef",
  version: 3,
  stamps_balance: 4,
  rewards_balance: 1,
  display_name: "Lucía",
  customer_active: true,
  business_slug: "cafe-nomada",
  business_name: "Café Nómada",
  stamps_required: 9,
  reward_description: "Una bebida estándar de cortesía",
};

describe("Google Wallet", () => {
  test("el JWT está firmado con RS256 y se verifica con la llave pública", () => {
    const jwt = signJwt({ hello: "mundo" }, pem);
    const [h, p, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${h}.${p}`);
    expect(verifier.verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });

  test("el enlace de guardado referencia solo el id del objeto", () => {
    const url = saveUrl(config, "3388000000000000000.tarjeta-x");
    expect(url.startsWith("https://pay.google.com/gp/v/save/")).toBe(true);
    const payload = JSON.parse(Buffer.from(url.split("/").pop()!.split(".")[1], "base64url").toString());
    expect(payload).toMatchObject({
      aud: "google",
      typ: "savetowallet",
      iss: config.serviceAccount.client_email,
      origins: [config.appUrl],
      payload: { loyaltyObjects: [{ id: "3388000000000000000.tarjeta-x" }] },
    });
  });

  test("el objeto no lleva contacto ni código escaneable y muestra el progreso", () => {
    const obj = buildLoyaltyObject(config, card);
    expect(obj).toMatchObject({
      id: "3388000000000000000.tarjeta-0123456789abcdef0123456789abcdef",
      classId: "3388000000000000000.cafe-nomada-fidelidad",
      state: "ACTIVE",
      accountId: "01234567",
      accountName: "Lucía",
      loyaltyPoints: { label: "Sellos", balance: { string: "4 de 9" } },
      secondaryLoyaltyPoints: { label: "Recompensas", balance: { int: 1 } },
    });
    expect(obj).not.toHaveProperty("barcode");
    expect(obj.linksModuleData.uris[0].uri).toBe("https://fidelidad-demo.iautomexa.com/tarjeta");
    expect(buildLoyaltyObject(config, { ...card, customer_active: false }).state).toBe("INACTIVE");
  });

  test("la clase exige logotipo público", () => {
    expect(buildLoyaltyClass(config, card)).toMatchObject({ reviewStatus: "UNDER_REVIEW", hexBackgroundColor: "#3D2C24", issuerName: "Café Nómada" });
    expect(() => buildLoyaltyClass({ ...config, logoUrl: null }, card)).toThrow(/LOGO_URL/);
  });
});
