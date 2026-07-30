import { NextRequest, NextResponse } from "next/server";
import { withApiErrorHandling, parseJsonBody } from "@/lib/api-error";

async function handler(request: NextRequest) {
  const body = await parseJsonBody(request);
  const { password } = body;

  if (!password) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    // 未配置管理员密钥，禁止开发者模式
    return NextResponse.json({ valid: false, disabled: true }, { status: 200 });
  }

  const valid = password === adminKey;
  return NextResponse.json({ valid });
}

export const POST = withApiErrorHandling(handler);