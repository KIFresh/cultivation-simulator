import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, requireAdminKey } from "@/lib/auth-helpers";
import { syncProviderConfig } from "@/lib/narrative";

const PROVIDER_FIELDS = ["AI_PROVIDER_1", "AI_PROVIDER_2", "AI_PROVIDER_3"] as const;
const SENSITIVE_SUFFIX = "_KEY";

function isAuthorized(request: NextRequest) {
  return requireAdminKey(request.headers.get("x-admin-key"));
}

function publicSettings(settings: { key: string; value: string }[]) {
  const stored = new Map(settings.map((setting) => [setting.key, setting.value]));
  const output: Record<string, string | boolean> = {};
  for (const provider of PROVIDER_FIELDS) {
    output[provider] = stored.get(provider) ?? "";
    output[`${provider}_MODEL`] = stored.get(`${provider}_MODEL`) ?? "";
    output[`${provider}_BASE_URL`] = stored.get(`${provider}_BASE_URL`) ?? "";
    output[`${provider}_KEY_CONFIGURED`] = Boolean(stored.get(`${provider}${SENSITIVE_SUFFIX}`));
  }
  return output;
}

// GET — 管理员读取非敏感配置；API Key 永不返回浏览器。
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return apiError("管理员密钥无效", 401, "ADMIN_REQUIRED");
  try {
    const settings = await prisma.appSetting.findMany();
    return NextResponse.json({ settings: publicSettings(settings) });
  } catch (error) {
    console.error("读取配置失败:", error);
    return NextResponse.json({ error: "读取配置失败" }, { status: 500 });
  }
}

// POST — 仅管理员可保存。Key 更新有 keep / set / clear 三种明确语义。
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return apiError("管理员密钥无效", 401, "ADMIN_REQUIRED");
  try {
    const body = await request.json();
    const { settings } = body;
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return apiError("无效的配置数据");
    }

    const entries = Object.entries(settings).filter(([key, value]) =>
      /^AI_PROVIDER_[1-3](?:_(?:KEY|MODEL|BASE_URL|KEY_ACTION))?$/.test(key)
      && typeof value === "string",
    ) as [string, string][];
    await prisma.$transaction(async (tx) => {
      for (const [key, value] of entries) {
        if (key.endsWith("_KEY_ACTION")) {
          if (value === "clear") {
            await tx.appSetting.deleteMany({ where: { key: key.replace("_KEY_ACTION", "_KEY") } });
          }
          continue;
        }
        await tx.appSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      }
    });
    await syncProviderConfig();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("保存配置失败:", error);
    return NextResponse.json({ error: "保存配置失败" }, { status: 500 });
  }
}
