import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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
  } catch {
    return NextResponse.json({ valid: false }, { status: 500 });
  }
}