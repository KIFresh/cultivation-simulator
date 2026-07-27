import { NextRequest, NextResponse } from "next/server";

/**
 * @deprecated 年度推进接口已废弃。
 * 请使用 POST /api/advance-quarter 替代，季度推进到第 4 季时自动触发跨年逻辑
 * （年龄增长、属性成长、升学、职业、觉醒、寿元检查等）。
 *
 * 移除时间：下次大版本清理时删除此文件。
 */
export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: "此接口已废弃，请使用 /api/advance-quarter",
      code: "GONE_ADVANCE_YEAR",
    },
    { status: 410 },
  );
}
