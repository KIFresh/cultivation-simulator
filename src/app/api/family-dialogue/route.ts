import { NextRequest, NextResponse } from "next/server";
import { generateFamilyDialogue } from "@/lib/narrative";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { familyMemberName, familyMemberRelation, familyMemberAge, intimacy, cultivatorName, cultivatorAge, cultivatorRealm, cultivatorRealmLevel, playerMessage, dialogueHistory, worldId } = body;

    if (!familyMemberName || !cultivatorName || !playerMessage) {
      return NextResponse.json({ error: "缺少必填参数" }, { status: 400 });
    }

    const result = await generateFamilyDialogue({
      familyMemberName, familyMemberRelation, familyMemberAge, intimacy: intimacy || 50,
      cultivatorName, cultivatorAge: cultivatorAge || 1, cultivatorRealm: cultivatorRealm || "凡人",
      cultivatorRealmLevel: cultivatorRealmLevel || 0,
      playerMessage, dialogueHistory: dialogueHistory || [], worldId,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("家庭对话生成失败:", error);
    return NextResponse.json({ error: "对话生成失败" }, { status: 500 });
  }
}