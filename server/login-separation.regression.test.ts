import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
const homePageSource = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");
const localLoginPageSource = readFileSync(new URL("../client/src/pages/LocalLogin.tsx", import.meta.url), "utf8");
const localAuthSource = readFileSync(new URL("./_core/localAuth.ts", import.meta.url), "utf8");
const localLoginRouteSource = readFileSync(new URL("./_core/index.ts", import.meta.url), "utf8");

describe("login separation regression safeguards", () => {
  it("keeps the public entry page split between manager fixed-email login and worker username login", () => {
    expect(homePageSource).toContain("المدير يدخل عبر البريد الإلكتروني الثابت وكلمة سر خاصة");
    expect(homePageSource).toContain("العمال وبقية المستخدمين عبر اسم المستخدم وكلمة السر");
    expect(homePageSource).toContain('href="/login"');
    expect(homePageSource).toContain("دخول المدير عبر البريد الإلكتروني وكلمة السر");
    expect(homePageSource).not.toContain('href="/api/auth/admin-login"');
    expect(homePageSource).not.toContain("تسجيل الدخول عبر Manus");
    expect(homePageSource).not.toContain("الدخول الموحد للمدير والعمال");
  });

  it("routes the official login page to LocalLogin and keeps a dedicated manager password section", () => {
    expect(appSource).toContain('import LocalLogin from "./pages/LocalLogin"');
    expect(appSource).toContain('<Route path={"/login"} component={LocalLogin} />');
    expect(localLoginPageSource).toContain("Manager-Login");
    expect(localLoginPageSource).toContain("info.fr@move-profis.de");
    expect(localLoginPageSource).toContain('fetch("/api/auth/admin-login"');
    expect(localLoginRouteSource).toContain("app.post('/api/auth/admin-login'");
    expect(localLoginPageSource).toContain("Passwort vergessen? Reset-Link anfordern");
  });

  it("keeps the worker username/password route restricted to non-admin users", () => {
    expect(localLoginPageSource).toContain('loginType: "staff"');
    expect(localLoginPageSource).toContain("Mitarbeiter-Login");
    expect(localLoginRouteSource).toContain("authenticateLocalCredentials(req.body ?? {})");
    expect(localAuthSource).toContain("user.role === 'admin' || loginType === 'admin'");
    expect(localAuthSource).toContain("Geschäftsführer melden sich nur über info.fr@move-profis.de und ihr Passwort an.");
  });
});
