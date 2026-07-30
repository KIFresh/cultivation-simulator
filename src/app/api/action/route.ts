import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { executeAction, type ActionResult } from "@/server/action/action-service";
import { streamNarrativeResult } from "@/lib/narrative-stream";
import { withApiErrorHandling, badRequest, parseJsonBody } from "@/lib/api-error";

async function handler(request: NextRequest) {
  const auth = await requireCultivator(request);
  if ("error" in auth) return auth.error;
  const cultivator = auth.cultivator;

  const body = await parseJsonBody(request);
  const { actionId, freeInput, worldId, attributes } = body;
  const cleanNpcValues = (value: unknown) =>
    Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim())
          .slice(0, 5)
      : undefined;
  const npcIds = cleanNpcValues(body.npcIds);
  const npcNames = cleanNpcValues(body.npcNames);
  const familyMemberId =
    typeof body.familyMemberId === "string" && body.familyMemberId.trim().length > 0
      ? body.familyMemberId.trim()
      : undefined;
  const isStream = new URL(request.url).searchParams.get("stream") === "true";
  if (!actionId)
    return NextResponse.json(badRequest("缺少必填参数: actionId").toJSON(), { status: 400 });

  const result = await executeAction(
    { actionId, freeInput, worldId, attributes, npcIds, npcNames, familyMemberId },
    cultivator
  );

  if (result.status === "daoXiao") {
    return NextResponse.json({ daoXiao: true, summary: result.summary });
  }

  if (result.status === "error") {
    return NextResponse.json({ error: result.message }, { status: result.code ?? 400 });
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
}

export const POST = withApiErrorHandling(handler);
