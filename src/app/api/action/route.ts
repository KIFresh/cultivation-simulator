import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { executeAction, type ActionResult } from "@/server/action/action-service";
import { streamNarrativeResult } from "@/lib/narrative-stream";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCultivator(request);
    if ("error" in auth) return auth.error;
    const cultivator = auth.cultivator;

    const body = await request.json();
    const { actionId, freeInput, worldId, attributes } = body;
    const isStream = new URL(request.url).searchParams.get("stream") === "true";
    if (!actionId) return NextResponse.json({ error: "缺少必填参数" }, { status: 400 });

    const result = await executeAction(
      { actionId, freeInput, worldId, attributes },
      cultivator
    );

    if (result.status === "daoXiao") {
      return NextResponse.json({ daoXiao: true, summary: result.summary });
    }

    if (result.status === "error") {
      return NextResponse.json(
        { error: result.message },
        { status: result.code ?? 400 }
      );
    }

    const { data } = result;
    const capped = {
      ...data.cultivator,
      stamina: Math.min(data.cultivator.stamina, data.cultivator.stamina),
    };
    const actionResult = {
      narrative: data.narrativeResult,
      cultivator: capped,
      expGained: data.expGained,
      combatExpGain: data.combatExpGain,
      canBreakthrough: data.canBreakthrough,
      awakenEvent: data.awakenEvent,
      techniqueEvents: data.techniqueEvents,
    };
    if (isStream) {
      return streamNarrativeResult(
        data.actionEventId ?? capped.id,
        data.narrativeResult,
        actionResult,
        capped
      );
    }
    return NextResponse.json(actionResult);
  } catch (error) {
    console.error("行动执行失败:", error);
    return NextResponse.json({ error: "行动执行失败" }, { status: 500 });
  }
}
