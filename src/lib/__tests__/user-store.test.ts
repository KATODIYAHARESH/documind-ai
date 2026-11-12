import { describe, expect, it } from "vitest";
import { createUser, findUserByEmail, verifyCredentials } from "@/lib/user-store";

describe("demo user store", () => {
  it("shares registered accounts for normalized email lookups", () => {
    const email = ` auth-${crypto.randomUUID()}@example.com `;
    const user = createUser("Test User", email, "correct-horse");

    expect(findUserByEmail(email.toUpperCase())).toEqual(user);
    expect(verifyCredentials(email, "correct-horse")).toEqual(user);
    expect(verifyCredentials(email, "wrong-password")).toBeNull();
  });

  it("rejects duplicate accounts after normalizing email", () => {
    const email = `duplicate-${crypto.randomUUID()}@example.com`;
    createUser("First User", email, "correct-horse");

    expect(() => createUser("Second User", email.toUpperCase(), "another-password"))
      .toThrow("An account with this email already exists.");
  });
});
