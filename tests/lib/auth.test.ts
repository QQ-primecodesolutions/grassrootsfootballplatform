import { describe, expect, it } from "vitest";
import { clientIp, LOCKOUT, lockoutMessage, lockoutState } from "@/lib/auth/lockout";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { passwordProblem } from "@/lib/auth/password-rules";
import { hashLinkToken, isLinkTokenShape, newLinkToken } from "@/lib/auth/tokens";
import {
  inviteSchema,
  organisationCreateSchema,
  parseHashtags,
} from "@/lib/platform/organisation-input";

describe("passwords", () => {
  it("hashes with a salt and verifies only the right password", async () => {
    const a = await hashPassword("blue kettle river song");
    const b = await hashPassword("blue kettle river song");
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(a).not.toBe(b);
    expect(await verifyPassword("blue kettle river song", a)).toBe(true);
    expect(await verifyPassword("blue kettle river son", a)).toBe(false);
    expect(await verifyPassword("", a)).toBe(false);
  });

  it("never accepts a missing or malformed hash", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
    expect(await verifyPassword("anything", "plain-text")).toBe(false);
    expect(await verifyPassword("anything", "scrypt$0$8$1$a$b")).toBe(false);
  });

  it("asks for a long password that isn't the email", () => {
    expect(passwordProblem("short", "a@b.co")).toMatch(/at least 10/);
    expect(passwordProblem("someone@club.co.za", "Someone@Club.co.za")).toMatch(/email/);
    expect(passwordProblem("blue kettle river song", "a@b.co")).toBeNull();
  });
});

describe("one-time links", () => {
  it("stores only a hash and recognises the token shape", () => {
    const { token, hash } = newLinkToken();
    expect(isLinkTokenShape(token)).toBe(true);
    expect(hash).toBe(hashLinkToken(token));
    expect(hash).not.toContain(token);
    expect(isLinkTokenShape("../etc/passwd")).toBe(false);
    expect(isLinkTokenShape(token + "x")).toBe(false);
  });
});

describe("login lockout", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  it("allows sign-in below the limit and counts down", () => {
    expect(lockoutState([], 0, now)).toEqual({ blocked: false, attemptsLeft: 5 });
    expect(lockoutState([minutesAgo(1), minutesAgo(2)], 2, now)).toEqual({ blocked: false, attemptsLeft: 3 });
  });

  it("blocks an IP after 5 failures in 15 minutes, until the oldest leaves the window", () => {
    const failures = [1, 2, 3, 4, 10].map(minutesAgo);
    const state = lockoutState(failures, 5, now);
    expect(state).toEqual({ blocked: true, reason: "ip", retryAfterMinutes: 5 });
    expect(lockoutMessage(state as Extract<typeof state, { blocked: true }>)).toMatch(/5 minutes/);
  });

  it("ignores failures older than the window", () => {
    expect(lockoutState([1, 2, 3, 4, 16].map(minutesAgo), 5, now)).toEqual({ blocked: false, attemptsLeft: 1 });
  });

  it("pauses everyone when failures from all IPs pass the global cap", () => {
    expect(lockoutState([], LOCKOUT.global, now)).toMatchObject({ blocked: true, reason: "global" });
  });

  it("reads the client IP from platform headers", () => {
    expect(clientIp(new Headers({ "x-real-ip": "41.1.2.3" }))).toBe("41.1.2.3");
    expect(clientIp(new Headers({ "x-forwarded-for": "41.1.2.3, 10.0.0.1" }))).toBe("41.1.2.3");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("organisation form", () => {
  const valid = {
    name: "Thabo Mofutsanyana Cup",
    slug: "Thabo-Cup",
    shortName: "",
    tagline: "",
    primaryColor: "#1f7a3f",
    secondaryColor: "#F2C230",
    logoUrl: "",
    facebook: "https://web.facebook.com/profile.php?id=123",
    hashtags: "#KasiSoccer, QwaQwa #kasisoccer",
  };

  it("normalises input", () => {
    const r = organisationCreateSchema.parse(valid);
    expect(r).toMatchObject({
      slug: "thabo-cup",
      shortName: null,
      primaryColor: "#1F7A3F",
      logoUrl: null,
      facebook: "https://www.facebook.com/profile.php?id=123",
      hashtags: ["#KasiSoccer", "#QwaQwa", "#kasisoccer"],
    });
  });

  it("rejects reserved or malformed link names and unsafe links", () => {
    expect(organisationCreateSchema.safeParse({ ...valid, slug: "admin" }).success).toBe(false);
    expect(organisationCreateSchema.safeParse({ ...valid, slug: "a--b" }).success).toBe(false);
    expect(organisationCreateSchema.safeParse({ ...valid, slug: "a b" }).success).toBe(false);
    expect(organisationCreateSchema.safeParse({ ...valid, logoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(organisationCreateSchema.safeParse({ ...valid, logoUrl: "http://x.co/logo.png" }).success).toBe(false);
    expect(organisationCreateSchema.safeParse({ ...valid, logoUrl: "/brand/qdl.png" }).success).toBe(true);
    expect(organisationCreateSchema.safeParse({ ...valid, facebook: "https://evil.example/facebook.com/" }).success).toBe(false);
    expect(organisationCreateSchema.safeParse({ ...valid, primaryColor: "green" }).success).toBe(false);
  });

  it("parses hashtags", () => {
    expect(parseHashtags("")).toEqual([]);
    expect(parseHashtags("##Kasi  Soccer!")).toEqual(["#Kasi", "#Soccer"]);
  });

  it("validates invites", () => {
    expect(inviteSchema.parse({ name: " Lerato ", email: " Lerato@Club.CO.ZA " })).toEqual({
      name: "Lerato",
      email: "lerato@club.co.za",
    });
    expect(inviteSchema.safeParse({ name: "Lerato", email: "not-an-email" }).success).toBe(false);
  });
});
