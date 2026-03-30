const AUTOSLM_API_BASE = process.env["AUTOSLM_API_BASE"] ?? "";
const AUTOSLM_ACCESS_CODE = process.env["AUTOSLM_ACCESS_CODE"] ?? "";
const AUTOSLM_DEALER_CODE = process.env["AUTOSLM_DEALER_CODE"] ?? "1011";

export interface AutoSLMUserProfile {
  userId: string;
  displayName: string;
  levelId: string;
  role: string;
  rid: string;
  retailerName: string;
  email: string;
  mobile: string;
  mobileLogo: string;
  dealerGroups: string;
  retailerOptions: string;
}

export class AutoSLMAuthError extends Error {
  constructor(
    message: string,
    public readonly isCredentialError: boolean = false,
  ) {
    super(message);
    this.name = "AutoSLMAuthError";
  }
}

export async function checkAutoSLMLogin(
  username: string,
  password: string,
): Promise<AutoSLMUserProfile> {
  if (!AUTOSLM_API_BASE) {
    throw new AutoSLMAuthError("AUTOSLM_API_BASE is not configured", false);
  }

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    response = await fetch(AUTOSLM_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        Params: {
          InputMethod: "CheckLogin",
          SecurityData: {
            AccessCode: AUTOSLM_ACCESS_CODE,
            DealerCode: AUTOSLM_DEALER_CODE,
          },
          InputParams: {
            Username: username,
            Password: password,
          },
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new AutoSLMAuthError(`AutoSLM API unreachable: ${msg}`, false);
  }

  if (!response.ok) {
    throw new AutoSLMAuthError(
      `AutoSLM API error: HTTP ${response.status}`,
      false,
    );
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new AutoSLMAuthError("AutoSLM API returned invalid JSON", false);
  }

  const profile = parseAutoSLMResponse(data);
  if (!profile) {
    throw new AutoSLMAuthError("Invalid username or password", true);
  }

  return profile;
}

function str(v: unknown): string {
  return v == null ? "" : String(v);
}

function jsonStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function parseAutoSLMResponse(data: unknown): AutoSLMUserProfile | null {
  if (!data || typeof data !== "object") return null;

  const d = data as Record<string, unknown>;

  const candidates: unknown[] = [
    d["Dataset"],
    d["dataset"],
    d["Data"],
    d["data"],
    d["Result"],
    d["result"],
    d["Response"],
    d["response"],
    d,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    const row = Array.isArray(candidate)
      ? (candidate[0] as Record<string, unknown>)
      : (candidate as Record<string, unknown>);

    if (!row || typeof row !== "object") continue;

    const userId =
      str(row["userId"]) ||
      str(row["UserID"]) ||
      str(row["UserId"]) ||
      str(row["user_id"]);

    if (!userId) continue;

    return {
      userId,
      displayName:
        str(row["displayName"]) ||
        str(row["DisplayName"]) ||
        str(row["Name"]) ||
        str(row["name"]) ||
        str(row["Username"]) ||
        str(row["username"]),
      levelId:
        str(row["levelId"]) ||
        str(row["LevelID"]) ||
        str(row["LevelId"]) ||
        str(row["level_id"]),
      role:
        str(row["role"]) ||
        str(row["Role"]) ||
        str(row["UserRole"]) ||
        "sales",
      rid:
        str(row["rid"]) ||
        str(row["RID"]) ||
        str(row["Rid"]) ||
        str(row["dealerRid"]) ||
        str(row["DealerRID"]),
      retailerName:
        str(row["retailerName"]) ||
        str(row["RetailerName"]) ||
        str(row["Retailer"]) ||
        str(row["retailer"]),
      email: str(row["email"]) || str(row["Email"]) || str(row["EmailAddress"]),
      mobile:
        str(row["mobile"]) ||
        str(row["Mobile"]) ||
        str(row["MobileNumber"]) ||
        str(row["mobileNumber"]),
      mobileLogo:
        str(row["mobileLogo"]) ||
        str(row["MobileLogo"]) ||
        str(row["Logo"]) ||
        str(row["logo"]) ||
        str(row["logoUrl"]) ||
        str(row["LogoUrl"]),
      dealerGroups: jsonStr(
        row["dealerGroups"] ?? row["DealerGroups"] ?? row["Groups"] ?? null,
      ),
      retailerOptions: jsonStr(
        row["retailerOptions"] ??
          row["RetailerOptions"] ??
          row["Options"] ??
          null,
      ),
    };
  }

  return null;
}
