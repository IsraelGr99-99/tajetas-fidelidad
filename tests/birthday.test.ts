import { describe, expect, test } from "vitest";
import { parseBirthday } from "@/domain/customer/birthday";

describe("cumpleaños sin año", () => {
  test("acepta 29 de febrero y rechaza fechas imposibles", () => {
    expect(parseBirthday("2", "29")).toEqual({ month: 2, day: 29 });
    expect(parseBirthday("2", "30")).toBeNull();
    expect(parseBirthday("13", "1")).toBeNull();
    expect(parseBirthday("", "")).toBeNull();
  });
});
