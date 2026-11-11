import { describe, expect, it } from "vitest";
import { accountFromRow, authMessage } from "./cloud";

describe("compte en ligne", () => {
  it("remet un profil Supabase en compte Comparo", () => {
    const account = accountFromRow({
      id: "11111111-1111-4111-8111-111111111111",
      email: "Clara@exemple.ca",
      first_name: "Clara",
      last_name: "Martin",
      habits: null,
      notebook: null,
      memory: null,
      archive: null,
    });
    expect(account.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(account.email).toBe("clara@exemple.ca");
    expect(account.firstName).toBe("Clara");
    expect(account.name).toBe("Clara Martin");
    expect(account.pass).toBe("cloud");
  });

  it("traduit les erreurs de connexion", () => {
    expect(authMessage("Invalid login credentials")).toBe("Courriel ou mot de passe incorrect.");
    expect(authMessage("Email not confirmed")).toContain("Confirmez");
  });
});
