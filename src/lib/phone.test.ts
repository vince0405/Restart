import { describe, expect, it } from "vitest";
import {
  formatPhMobile,
  isPhoneSignInEmail,
  normalizePhMobile,
  parseOptionalEmail,
  phoneSignInEmail,
  signInEmailFor,
} from "./phone";

describe("Philippine mobile numbers", () => {
  it("accepts the ways people write the same number", () => {
    for (const raw of ["09171234567", "0917 123 4567", "0917-123-4567", "+63 917 123 4567", "639171234567", "9171234567"]) {
      expect(normalizePhMobile(raw)).toBe("+639171234567");
    }
  });

  it("refuses things that are not PH mobile numbers", () => {
    for (const raw of ["", "12345", "0817 123 4567", "0917 123 456", "091712345678", "abc"]) {
      expect(normalizePhMobile(raw)).toBeNull();
    }
  });

  it("formats a number for people to read", () => {
    expect(formatPhMobile("+639171234567")).toBe("0917 123 4567");
  });
});

describe("signing in with a mobile number or an email", () => {
  it("turns a mobile number into the internal sign-in name", () => {
    expect(phoneSignInEmail("+639171234567")).toBe("639171234567@phone.rps1.invalid");
    expect(signInEmailFor("0917 123 4567")).toBe("639171234567@phone.rps1.invalid");
    expect(isPhoneSignInEmail("639171234567@phone.rps1.invalid")).toBe(true);
    expect(isPhoneSignInEmail("someone@gmail.com")).toBe(false);
  });

  it("still accepts a real email for older accounts", () => {
    expect(signInEmailFor("  Beldadjo@Gmail.com ")).toBe("beldadjo@gmail.com");
  });

  it("refuses something that is neither", () => {
    expect(signInEmailFor("hello")).toBeNull();
    expect(signInEmailFor("")).toBeNull();
  });

  it("treats the sign-up email as optional", () => {
    expect(parseOptionalEmail("")).toBeNull();
    expect(parseOptionalEmail(" Me@Mail.com ")).toBe("me@mail.com");
    expect(parseOptionalEmail("not-an-email")).toBe(false);
  });
});
