import { NextRequest, NextResponse } from "next/server";
import { requireCultivator } from "@/lib/auth-helpers";
import { executeAction, type ActionResult } from "@/server/action/action-service";
import { streamNarrativeResult, streamAIJob } from "@/lib/narrative-stream";
import {
  withApiErrorHandling,
  AppError,
  badRequest,
  parseJsonBody,
  serviceUnavailable,
} from "@/lib/api-error";
import { AllProvidersFailedError } from "@/lib/narrative/provider";

function actionProviderError(error: unknown): AppError {
  const failures = (error as { failures?: Array<{ code?: string }> }).failures;
  const codes = new Set((failures ?? []).map((failure) => failure.code));
  if (codes.has("HTTP_401")) return serviceUnavailable("AI 叙事服务 API Key 无效或未授权，请重新配置", error);
  if (codes.has("HTTP_404") || codes.has("MODEL_UNSUPPORTED"))
    return serviceUnavailable("AI 叙事服务接口地址或模型不存在，请检查配置", error);
  if (codes.has("TIMEOUT")) return serviceUnavailable("AI 叙事服务响应超时，请稍后重试", error);
  if (codes.has("EMPTY_RESPONSE"))
    return serviceUnavailable("AI 叙事服务返回了空内容，请重试或更换模型", error);
  return serviceUnavailable("AI 叙事服务暂时不可用，请稍后重试", error);
}

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

  if (isStream) {
    // 真流式：AI 边生成边推 narrative 正文，完成后执行事务
    return streamAIJob({
      run: async (onDelta) => {
        let result: ActionResult;
        try {
          result = await executeAction(
            { actionId, freeInput, worldId, attributes, npcIds, npcNames, familyMemberId },
            cultivator,
            { onDelta }
          );
        } catch (error) {
          if (error instanceof AllProvidersFailedError) throw actionProviderError(error);
          throw error;
        }
        if (result.status === "daoXiao") {
          return { result: { daoXiao: true, summary: result.summary } };
        }
        if (result.status === "error") {
          throw new Error(result.message || "行动执行失败");
        }
        const { data } = result;
        const capped = {
          ...data.cultivator,
          stamina: Math.min(data.cultivator.stamina, data.cultivator.stamina),
        };
        return {
          result: {
            narrative: data.narrativeResult,
            cultivator: capped,
            expGained: data.expGained,
            combatExpGain: data.combatExpGain,
            canBreakthrough: data.canBreakthrough,
            awakenEvent: data.awakenEvent,
            techniqueEvents: data.techniqueEvents,
          },
        };
      },
      errorMessage: "行动叙事生成失败，请稍后重试",
    });
  }

  let result: ActionResult;
  try {
    result = await executeAction(
      { actionId, freeInput, worldId, attributes, npcIds, npcNames, familyMemberId },
      cultivator
    );
  } catch (error) {
    if (error instanceof AllProvidersFailedError) throw actionProviderError(error);
    throw error;
  }

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