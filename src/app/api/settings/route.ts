import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncProviderConfig } from "@/lib/narrative";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";
import { logger } from "@/lib/logger";

const PROVIDER_FIELDS = ["AI_PROVIDER_1", "AI_PROVIDER_2", "AI_PROVIDER_3"] as const;
const SENSITIVE_SUFFIX = "_KEY";

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

async function getHandler() {
  const settings = await prisma.appSetting.findMany();
  return NextResponse.json({ settings: publicSettings(settings) });
}

async function postHandler(request: NextRequest) {
  const body = await parseJsonBody(request);
  const { settings } = body;
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return NextResponse.json({ error: "无效的配置数据" }, { status: 400 });
  }

  const entries = Object.entries(settings).filter(
    ([key, value]) =>
      /^AI_PROVIDER_[1-3](?:_(?:KEY|MODEL|BASE_URL|KEY_ACTION))?$/.test(key) &&
      typeof value === "string"
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
}

export const GET = withApiErrorHandling(getHandler);
export const POST = withApiErrorHandling(postHandler);