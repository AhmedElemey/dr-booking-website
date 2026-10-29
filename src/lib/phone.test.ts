import { describe, expect, it } from "vitest";

import { formatEgyptPhone, isolateLtr, normalizeEgyptPhone, toAsciiDigits } from "./phone";

describe("normalizeEgyptPhone", () => {
  it.each([
    ["01012345678", "+201012345678"],
    ["+201012345678", "+201012345678"],
    ["201012345678", "+201012345678"],
    ["010 1234 5678", "+201012345678"],
    ["010-1234-5678", "+201012345678"],
    ["٠١٠١٢٣٤٥٦٧٨", "+201012345678"],
    ["01112345678", "+201112345678"],
    ["01212345678", "+201212345678"],
    ["01512345678", "+201512345678"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeEgyptPhone(input)).toBe(expected);
  });

  it.each(["", "0101234567", "010123456789", "01312345678", "+971501234567", "abc", "0221234567"])(
    "rejects %s",
    (input) => {
      expect(normalizeEgyptPhone(input)).toBeNull();
    },
  );
});

describe("phone helpers", () => {
  it("converts Arabic-Indic and Persian digits", () => {
    expect(toAsciiDigits("١٢٣٤٥٦")).toBe("123456");
    expect(toAsciiDigits("۱۲۳")).toBe("123");
  });

  it("formats E.164 for display and isolates it for RTL text", () => {
    expect(formatEgyptPhone("+201012345678")).toBe("+20 101 234 5678");
    expect(isolateLtr("+20 1")).toBe("⁦+20 1⁩");
  });
});
