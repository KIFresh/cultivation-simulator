"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/top-nav";
import MemoryPanel from "@/components/memory-panel";
import DaoXiaoModal from "@/components/dao-xiao-modal";
import CompetitionResultModal from "@/components/competition-result-modal";
import TechniquePanel from "@/components/technique-panel";
import { StatusGauge } from "@/app/dashboard/_components/status-gauge";
import { AttributeGrid } from "@/app/dashboard/_components/attribute-grid";
import { NarrativePanel } from "@/app/dashboard/_components/narrative-panel";
import { InventoryPanel } from "@/app/dashboard/_components/inventory-panel";
import { NpcChatPanel } from "@/app/dashboard/_components/npc-chat-panel";
import { useDashboardState } from "@/app/dashboard/hooks/use-dashboard-state";
import { useGameStore } from "@/store";
import { useDevTools } from "@/app/dashboard/hooks/use-dashboard-dev-tools";
import { getRootInfo, formatSpiritualRootLabel } from "@/lib/cultivation-data";
import { mergeNpcs } from "@/lib/npc-utils";

export default function DashboardPage() {
  const router = useRouter();
  const {
    cultivator,
    loading,
    narrative,
    narrativeHistory,
    streamingText,
    availableActions,
    canBreak,
    awakenEvent,
    advancing,
    attributes,
    inventory,
    occupation,
    schoolRank,
    unlockedLocs,
    activeActionId,
    actionInput,
    setActionInput,
    narrativeExpanded,
    npcChat,
    setNpcChat,
    npcMessage,
    setNpcMessage,
    npcChatHistory,
    devMode,
    techniquePanelOpen,
    daoXiao,
    warnEarly,
    remaining,
    maxAge,
    isAwake,
    realmLabel,
    schoolStage,
    schoolGrade,
    displayOccupation,
    locs,
    currentLoc,
    currentNPCs,
    familyMembers,
    maxStamina,
    cliqueInfo,
    actions,
    handleActionClick,
    handleSubmitWithInput,
    handleBreakthrough,
    advanceSeason,
    handleUseItem,
    sendNpcMessage,
    setAwakenEvent,
    setTechniquePanelOpen,
    setDaoXiao,
    setWarnEarly,
    setNarrativeExpanded,
    setShowItems,
    showItems,
  } = useDashboardState();

  const devTools = useDevTools({
    onAfterCreate: () => {
      window.location.reload();
    },
  });

  const competitionResults = useGameStore((s) => s.competitionResults);
  const finalExamResult = useGameStore((s) => s.finalExamResult);

  // 合并附近 NPC：家庭成员优先，同名/同关系的地点 NPC 去重
  // 必须放在所有条件 return 前，避免 React Hook 顺序错乱
  const mergedNpcs = useMemo(
    () => mergeNpcs(familyMembers ?? [], currentNPCs ?? []),
    [familyMembers, currentNPCs]
  );

  if (loading)
    return (
      <main
        className="flex-1 flex items-center justify-center min-h-screen bg-[var(--background)]"
        style={{ fontFamily: "'Noto Serif SC','Songti SC','STSong','SimSun','宋体',Georgia,serif" }}
      >
        <p className="text-[var(--muted-foreground)]">加载中…</p>
      </main>
    );
  if (!cultivator)
    return (
      <main
        className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[var(--background)] p-4"
        style={{ fontFamily: "'Noto Serif SC','Songti SC','STSong','SimSun','宋体',Georgia,serif" }}
      >
        <p className="text-[var(--muted-foreground)] mb-4">尚未创建修炼者</p>
        <div className="flex gap-2">
          {devMode ? (
            <>
              <button
                onClick={devTools.handleQuickCreate}
                className="px-4 py-2 rounded-xl bg-[var(--destructive)] text-white text-sm font-medium tracking-widest shadow-sm hover:bg-[var(--destructive)] transition-colors"
              >
                快速生成
              </button>
              <button
                onClick={devTools.handleReset}
                className="px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] text-sm font-medium hover:border-[var(--destructive)] transition-colors"
              >
                重置数据
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/create")}
              className="px-4 py-2 rounded-xl bg-[var(--destructive)] text-white text-sm font-medium tracking-widest shadow-sm hover:bg-[var(--destructive)] transition-colors"
            >
              创建角色
            </button>
          )}
        </div>
      </main>
    );

  const currentLocName = locs.find((l: any) => l.id === currentLoc)?.name || "";

  return (
    <main
      className="min-h-screen bg-[var(--background)] text-[var(--foreground)]"
      style={{ fontFamily: "'Noto Serif SC','Songti SC','STSong','SimSun','宋体',Georgia,serif" }}
    >
      <TopNav />

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-5 space-y-6">
          <div className="silk-card rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-6 right-8 text-center select-none">
              <div className="seal-mark border-2 border-[var(--destructive)] text-[var(--destructive)] px-3 py-1 text-sm font-bold calligraphy bg-[var(--card)] inline-block rounded-sm">
                {realmLabel}
              </div>
              <div className="text-[10px] text-[var(--muted-foreground)] mt-1 font-mono">
                {cultivator.age} 岁
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-bold calligraphy mb-1 tracking-wider text-[var(--primary)]">
                {cultivator.name}
              </h2>
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-[var(--ring)] font-bold">
                  {formatSpiritualRootLabel(
                    cultivator.spiritualRoot,
                    getRootInfo(cultivator.spiritualRoot),
                    cultivator.realm
                  )}
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">
                  {displayOccupation === "婴儿" ? "🍼" : displayOccupation === "学生" ? "📚" : "👤"}{" "}
                  {displayOccupation}
                </span>
              </div>
              <div className="flex items-center space-x-2 mt-1 text-[11px] text-gray-400">
                {schoolStage && (
                  <span>
                    📖 {schoolStage.name}
                    {schoolGrade}年级{schoolRank !== "普通" ? `（${schoolRank}）` : ""}
                  </span>
                )}
                {schoolStage && cliqueInfo && <span>🤝 {cliqueInfo.name}</span>}
                {currentLocName && <span>📍 {currentLocName}</span>}
              </div>
            </div>

            <div className="space-y-6 border-t border-b border-[var(--border)] py-6 mb-6">
              {isAwake && (
                <StatusGauge
                  label="修炼值"
                  value={cultivator.cultivationExp}
                  max={100}
                  hint="累计修炼值"
                />
              )}
              <StatusGauge
                label="行动力"
                value={cultivator.stamina}
                max={maxStamina}
                hint={`${cultivator.stamina} / ${maxStamina}`}
              />
              {maxAge !== null && maxAge > 0 && (
                <StatusGauge
                  label="寿元"
                  value={Math.max(0, remaining)}
                  max={maxAge}
                  hint={`剩余 ${Math.max(0, remaining)} 年`}
                />
              )}
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">金币存余</span>
                </div>
                <p className="font-mono font-bold text-sm text-[var(--destructive)]">
                  {cultivator.gold ?? 50}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">❤️ 健康值</span>
                  {cultivator.injuryDebuff > 0 && (
                    <span className="text-[10px] text-red-500">
                      受伤 {cultivator.injuryDebuff} 轮
                    </span>
                  )}
                </div>
                <p className="font-mono font-bold text-sm text-[var(--foreground)]">
                  {cultivator.health ?? 100}
                </p>
              </div>
              {(cultivator.savings ?? 0) > 0 && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">🏦 储蓄</span>
                  </div>
                  <p className="font-mono font-bold text-sm text-[var(--foreground)]">{cultivator.savings}</p>
                </div>
              )}
            </div>

            <AttributeGrid attributes={attributes} />

            {(inventory || []).some((i: any) => i.itemId === "phone") && (
              <button
                onClick={() => router.push("/phone")}
                className="mt-4 w-full flex items-center gap-2 text-xs bg-[var(--muted)] text-[var(--primary)] border border-[var(--destructive)]/20 rounded-lg px-3 py-2 hover:bg-[var(--destructive)]/10 transition-colors"
              >
                📱 打开手机
              </button>
            )}
            {isAwake && (
              <p className="text-gray-400 text-xs mt-3">累计修炼值：{cultivator.totalExp}</p>
            )}
          </div>
        </section>

        <section className="lg:col-span-7 space-y-6">
          {awakenEvent && (
            <div className="silk-card border-[var(--destructive)]/40 bg-[var(--muted)] rounded-3xl p-6">
              <p className="text-[var(--destructive)] font-bold text-lg mb-2">{awakenEvent.title}</p>
              <p className="text-[var(--foreground)] text-sm whitespace-pre-wrap">{awakenEvent.narrative}</p>
              <button
                onClick={() => setAwakenEvent(null)}
                className="mt-3 w-full py-2.5 rounded-xl bg-[var(--destructive)] text-white text-sm font-medium tracking-widest shadow-sm hover:bg-[var(--destructive)] transition-colors"
              >
                踏入仙途
              </button>
            </div>
          )}

          <div className="silk-card rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="text-[var(--destructive)] text-sm">📍</div>
                <h3 className="text-sm font-bold text-[var(--foreground)]/80">
                  当前境域：<span>{currentLocName}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    （第{cultivator.quarter ?? 1}季）
                  </span>
                </h3>
              </div>
            </div>

            {mergedNpcs.length > 0 && (
              <div className="flex flex-wrap gap-3 items-center text-xs">
                <span className="text-gray-400">附近的人：</span>
                <div className="flex flex-wrap gap-2">
                  {mergedNpcs.map((npc: any) => (
                    <button
                      key={npc._key}
                      onClick={() => setNpcChat(npc)}
                      className="bg-[var(--muted)] text-[var(--primary)] px-3 py-1.5 rounded-xl border border-[var(--destructive)]/20 flex items-center space-x-2 cursor-pointer hover:scale-105 transition-transform"
                    >
                      <span>{npc.avatar}</span>
                      <span className="font-bold">
                        {npc.name}
                        {npc.age != null ? (
                          <span className="font-normal opacity-70 text-[9px]">（{npc.age}岁）</span>
                        ) : null}
                        {npc._src !== "family" && isAwake && npc.realm ? (
                          <span className="font-normal opacity-70 text-[9px]">({npc.realm})</span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <InventoryPanel inventory={inventory || []} onUseItem={handleUseItem} />

            {npcChat && (
              <NpcChatPanel
                npc={npcChat}
                npcChatHistory={npcChatHistory}
                npcMessage={npcMessage}
                cultivatorStamina={cultivator?.stamina ?? 0}
                onSend={(msg) => sendNpcMessage(msg, npcChat, npcChatHistory)}
                onMessageChange={setNpcMessage}
                onClose={() => setNpcChat(null)}
              />
            )}
          </div>

          <NarrativePanel
            narrative={narrative}
            streamingText={streamingText}
            availableActions={availableActions}
            activeActionId={activeActionId}
            actionLoading={advancing}
            cultivator={cultivator}
            currentNPCs={mergedNpcs}
            familyMembers={[]}
            isAwake={isAwake}
            narrativeExpanded={narrativeExpanded}
            onExpandToggle={() => setNarrativeExpanded(!narrativeExpanded)}
            onActionClick={handleActionClick}
            onActionSubmit={handleSubmitWithInput}
          />

          <div className="flex gap-2">
            {canBreak && (
              <button
                className="flex-1 bg-[var(--destructive)] hover:bg-[var(--destructive)] text-white h-12 text-base rounded-xl shadow-sm transition-colors flex items-center justify-center"
                onClick={handleBreakthrough}
              >
                境界突破
              </button>
            )}
            <button
              className="flex-1 border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--muted)] text-[var(--foreground)] h-12 text-base rounded-xl transition-colors flex items-center justify-center"
              onClick={advanceSeason}
              disabled={advancing}
            >
              推进季节
            </button>
          </div>

          <MemoryPanel cultivatorId={cultivator.id} />

          {isAwake && (
            <button
              onClick={() => setTechniquePanelOpen(true)}
              className="w-full flex items-center gap-2 text-xs bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2 hover:bg-[var(--muted)] hover:border-[var(--destructive)] transition-colors text-[var(--foreground)]"
            >
              📖 功法
            </button>
          )}
        </section>
      </div>

      <TechniquePanel
        cultivatorId={cultivator.id}
        open={techniquePanelOpen}
        onOpenChange={setTechniquePanelOpen}
      />

      {daoXiao && (
        <DaoXiaoModal
          open={true}
          cultivatorName={daoXiao.name}
          userId={cultivator.id}
          summary={daoXiao.summary}
          onClose={() => setDaoXiao(null)}
        />
      )}

      {(competitionResults || finalExamResult) && (
        <CompetitionResultModal
          competitionResults={competitionResults}
          finalExamResult={finalExamResult}
          onClose={() => {
            useGameStore.getState().setCompetitionResults(null);
            useGameStore.getState().setFinalExamResult(null);
          }}
        />
      )}

      {warnEarly && (
        <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto z-50">
          <div className="bg-[var(--muted)] border border-[var(--destructive)]/30 rounded-lg p-3 shadow-lg">
            <p className="text-[var(--destructive)] text-sm font-medium">⚠️ 大限将至</p>
            <p className="text-[var(--primary)] text-xs mt-1">
              仅剩 {remaining} 年寿元。突破境界可延年益寿。
            </p>
            <button
              onClick={() => setWarnEarly(false)}
              className="text-[var(--destructive)] text-xs underline mt-1"
            >
              知晓了
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .silk-card {
          background-color: var(--card);
          border: 1px solid var(--border);
          box-shadow: 0 4px 20px -2px rgba(122, 31, 24, 0.05);
          transition: all 0.25s ease;
        }
        .silk-card:hover {
          box-shadow: 0 8px 25px -2px rgba(122, 31, 24, 0.1);
          border-color: rgba(184, 50, 39, 0.35);
        }
        .vermilion-progress-solid {
          background-color: var(--destructive);
        }
        .nav-tag {
          transition: all 0.2s ease;
        }
        .nav-tag.active {
          background-color: var(--destructive) !important;
          color: #ffffff !important;
          border-color: var(--destructive) !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 10px rgba(184, 50, 39, 0.25);
        }
        .calligraphy {
          font-family: "Ma Shan Zheng", "STKaiti", "KaiTi", "楷体", "华文行楷", cursive, serif;
        }
        @keyframes sealDrop {
          0% {
            transform: scale(1.4) rotate(8deg);
            opacity: 0;
          }
          100% {
            transform: scale(1) rotate(-3deg);
            opacity: 0.95;
          }
        }
        .seal-mark {
          animation: sealDrop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2) forwards;
        }
      `}</style>
    </main>
  );
}
