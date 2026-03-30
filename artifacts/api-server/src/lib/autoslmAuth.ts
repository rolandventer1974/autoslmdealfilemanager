const AUTOSLM_API_BASE = process.env["AUTOSLM_API_BASE"] ?? "";
const AUTOSLM_ACCESS_CODE = process.env["AUTOSLM_ACCESS_CODE"] ?? "";
const AUTOSLM_DEALER_CODE = process.env["AUTOSLM_DEALER_CODE"] ?? "1011";

export interface AutoSLMUserProfile {
  userId: string;
  displayName: string;
  levelId: string;
  levelName: string;
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

/**
 * Parses the MobileAppV1 CheckLogin response.
 *
 * Actual response shape:
 * {
 *   "ResultSet": {
 *     "MessageCode": "1000",
 *     "Messagetxt": {
 *       "datacount": "1",
 *       "dataset": [{
 *         "rid": "1011",
 *         "retailername": "...",
 *         "userid": "91396",
 *         "name": "Mobile Test 2",
 *         "levelid": "9",
 *         "levelname": "Sales Exec",
 *         "active": "1",
 *         "email": "...",
 *         "mobile": "...",
 *         "retaileroptions": "...",
 *         "dealergroups": "...",
 *         "mobilelogohttps": "https://...",
 *         "mobilelogohttp": "http://..."
 *       }]
 *     }
 *   }
 * }
 *
 * MessageCode "1000" = success with results.
 * Failed login returns a different MessageCode or empty dataset.
 */
function parseAutoSLMResponse(data: unknown): AutoSLMUserProfile | null {
  if (!data || typeof data !== "object") return null;

  const d = data as Record<string, unknown>;
  const resultSet = d["ResultSet"] as Record<string, unknown> | undefined;
  if (!resultSet) return null;

  const messageCode = String(resultSet["MessageCode"] ?? "");
  if (messageCode !== "1000") return null;

  const messagetxt = resultSet["Messagetxt"] as Record<string, unknown> | undefined;
  if (!messagetxt) return null;

  const dataset = messagetxt["dataset"];
  if (!Array.isArray(dataset) || dataset.length === 0) return null;

  const row = dataset[0] as Record<string, unknown>;
  if (!row) return null;

  const userId = str(row["userid"]);
  if (!userId) return null;

  const rid = str(row["rid"]);
  const levelName = str(row["levelname"]);

  return {
    userId,
    displayName: str(row["name"]),
    levelId: str(row["levelid"]),
    levelName,
    role: levelName || "sales",
    rid,
    retailerName: str(row["retailername"]),
    email: str(row["email"]),
    mobile: str(row["mobile"]),
    mobileLogo: str(row["mobilelogohttps"]) || str(row["mobilelogohttp"]),
    dealerGroups: jsonStr(row["dealergroups"]),
    retailerOptions: jsonStr(row["retaileroptions"]),
  };
}
