"use client";

import { useRouter } from "next/navigation";
import TopNav from "@/components/top-nav";
import MemoryPanel from "@/components/memory-panel";
import DaoXiaoModal from "@/components/dao-xiao-modal";
import TechniquePanel from "@/components/technique-panel";
import { StatusGauge } from "@/app/dashboard/_components/status-gauge";
import { AttributeGrid } from "@/app/dashboard/_components/attribute-grid";
import { NarrativePanel } from "@/app/dashboard/_components/narrative-panel";
import { InventoryPanel } from "@/app/dashboard/_components/inventory-panel";
import { NpcChatPanel } from "@/app/dashboard/_components/npc-chat-panel";
import { useDashboardState } from "@/app/dashboard/hooks/use-dashboard-state";
import { useDevTools } from "@/app/dashboard/hooks/use-dashboard-dev-tools";
import { getRootInfo, formatSpiritualRootLabel } from "@/lib/cultivation-data";

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
    memoryEntries,
    setMemoryEntries,
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

  if (loading) return (
    <main className="flex-1 flex items-center justify-center min-h-screen bg-[#FAF7F3]" style={{ fontFamily: "'Noto Serif SC','Songti SC','STSong','SimSun','宋体',Georgia,serif" }}>
      <p className="text-[#8a7a72]">加载中…</p>
    </main>
  );
  if (!cultivator) return (
    <main className="flex-1 flex flex-col items-center justify-center min-h-screen bg-[#FAF7F3] p-4" style={{ fontFamily: "'Noto Serif SC','Songti SC','STSong','SimSun','宋体',Georgia,serif" }}>
      <p className="text-[#8a7a72] mb-4">尚未创建修炼者</p>
      <div className="flex gap-2">
        {devMode ? (
          <>
            <button onClick={devTools.handleQuickCreate} className="px-4 py-2 rounded-xl bg-[#B83227] text-white text-sm font-medium tracking-widest shadow-sm hover:bg-[#7A1F18] transition-colors">快速生成</button>
            <button onClick={devTools.handleReset} className="px-4 py-2 rounded-xl border border-[#EADCD0] bg-white text-[#2C1E1E] text-sm font-medium hover:border-[#B83227] transition-colors">重置数据</button>
          </>
        ) : (
          <button onClick={() => router.push("/create")} className="px-4 py-2 rounded-xl bg-[#B83227] text-white text-sm font-medium tracking-widest shadow-sm hover:bg-[#7A1F18] transition-colors">创建角色</button>
        )}
      </div>
    </main>
  );

  const currentLocName = locs.find((l: any) => l.id === currentLoc)?.name || "";

  return (
    <main className="min-h-screen bg-[#FAF7F3] text-[#2C1E1E]" style={{ fontFamily: "'Noto Serif SC','Songti SC','STSong','SimSun','宋体',Georgia,serif" }}>
      <TopNav />

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-5 space-y-6">
          <div className="silk-card rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-6 right-8 text-center select-none">
              <div className="seal-mark border-2 border-[#B83227] text-[#B83227] px-3 py-1 text-sm font-bold calligraphy bg-white inline-block rounded-sm">
                {realmLabel}
              </div>
              <div className="text-[10px] text-amber-900/60 mt-1 font-mono">{cultivator.age} 岁</div>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-bold calligraphy mb-1 tracking-wider text-[#7A1F18]">{cultivator.name}</h2>
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-[#D49B4B] font-bold">{formatSpiritualRootLabel(cultivator.spiritualRoot, getRootInfo(cultivator.spiritualRoot))}</span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-500">{displayOccupation === "婴儿" ? "🍼" : displayOccupation === "学生" ? "📚" : "👤"} {displayOccupation}</span>
              </div>
              <div className="flex items-center space-x-2 mt-1 text-[11px] text-gray-400">
                {schoolStage && <span>📖 {schoolStage.name}{schoolGrade}年级{schoolRank !== "普通" ? `（${schoolRank}）` : ""}</span>}
                {schoolStage && cliqueInfo && <span>🤝 {cliqueInfo.name}</span>}
                {currentLocName && <span>📍 {currentLocName}</span>}
              </div>
            </div>

            <div className="space-y-6 border-t border-b border-[#EADCD0] py-6 mb-6">
              {isAwake && (
                <StatusGauge label="修炼值" value={cultivator.cultivationExp} max={100} hint="累计修炼值" />
              )}
              <StatusGauge label="行动力" value={cultivator.stamina} max={maxStamina} hint={`${cultivator.stamina} / ${maxStamina}`} />
              {maxAge !== null && maxAge > 0 && (
                <StatusGauge label="寿元" value={Math.max(0, remaining)} max={maxAge} hint={`剩余 ${Math.max(0, remaining)} 年`} />
              )}
              <div className="rounded-2xl border border-[#EADCD0] bg-white/80 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">金币存余</span>
                </div>
                <p className="font-mono font-bold text-sm text-[#B83227]">{cultivator.gold ?? 50}</p>
              </div>
              <div className="rounded-2xl border border-[#EADCD0] bg-white/80 p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">❤️ 健康值</span>
                  {cultivator.injuryDebuff > 0 && <span className="text-[10px] text-red-500">受伤 {cultivator.injuryDebuff} 轮</span>}
                </div>
                <p className="font-mono font-bold text-sm text-[#2C1E1E]">{cultivator.health ?? 100}</p>
              </div>
              {(cultivator.savings ?? 0) > 0 && (
                <div className="rounded-2xl border border-[#EADCD0] bg-white/80 p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500">🏦 储蓄</span>
                  </div>
                  <p className="font-mono font-bold text-sm text-[#2C1E1E]">{cultivator.savings}</p>
                </div>
              )}
            </div>

            <AttributeGrid attributes={attributes} />

            {(inventory || []).some((i: any) => i.itemId === "phone") && (
              <button onClick={() => router.push("/phone")}
                className="mt-4 w-full flex items-center gap-2 text-xs bg-[#FDF2F0] text-[#7A1F18] border border-[#B83227]/20 rounded-lg px-3 py-2 hover:bg-[#B83227]/10 transition-colors">
                📱 打开手机
              </button>
            )}
            {isAwake && <p className="text-gray-400 text-xs mt-3">累计修炼值：{cultivator.totalExp}</p>}
          </div>
        </section>

        <section className="lg:col-span-7 space-y-6">
          {awakenEvent && (
            <div className="silk-card border-[#B83227]/40 bg-[#FDF2F0] rounded-3xl p-6">
              <p className="text-[#B83227] font-bold text-lg mb-2">{awakenEvent.title}</p>
              <p className="text-[#2C1E1E] text-sm whitespace-pre-wrap">{awakenEvent.narrative}</p>
              <button onClick={() => setAwakenEvent(null)} className="mt-3 w-full py-2.5 rounded-xl bg-[#B83227] text-white text-sm font-medium tracking-widest shadow-sm hover:bg-[#7A1F18] transition-colors">踏入仙途</button>
            </div>
          )}

          <div className="silk-card rounded-3xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <div className="text-[#B83227] text-sm">📍</div>
                <h3 className="text-sm font-bold text-amber-950/80">
                  当前境域：<span>{currentLocName}</span>
                  <span className="ml-2 text-xs text-gray-400">
                    （第{cultivator.quarter ?? 1}季）
                  </span>
                </h3>
              </div>
            </div>

            {currentNPCs.length > 0 && (
              <div className="flex flex-wrap gap-3 items-center text-xs">
                <span className="text-gray-400">附近的人：</span>
                <div className="flex flex-wrap gap-2">
                  {currentNPCs.map((npc: any) => (
                    <button key={npc.name} onClick={() => setNpcChat(npc)} className="bg-[#FDF2F0] text-[#7A1F18] px-3 py-1.5 rounded-xl border border-[#B83227]/20 flex items-center space-x-2 cursor-pointer hover:scale-105 transition-transform">
                      <span>{npc.avatar}</span>
                      <span className="font-bold">{npc.name} {isAwake && npc.realm ? <span className="font-normal opacity-70 text-[9px]">({npc.realm})</span> : null}</span>
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
            currentNPCs={currentNPCs}
            familyMembers={familyMembers}
            narrativeExpanded={narrativeExpanded}
            onExpandToggle={() => setNarrativeExpanded(!narrativeExpanded)}
            onActionClick={handleActionClick}
            onActionSubmit={handleSubmitWithInput}
          />

          <div className="flex gap-2">
            {canBreak && (
              <button className="flex-1 bg-[#B83227] hover:bg-[#7A1F18] text-white h-12 text-base rounded-xl shadow-sm transition-colors flex items-center justify-center" onClick={handleBreakthrough}>
                境界突破
              </button>
            )}
            <button className="flex-1 border border-[#EADCD0] bg-white hover:bg-[#FDF2F0] text-[#2C1E1E] h-12 text-base rounded-xl transition-colors flex items-center justify-center" onClick={advanceSeason} disabled={advancing}>
              推进季节
            </button>
          </div>

          {narrativeHistory.length > 1 && (
            <div className="silk-card rounded-3xl p-6">
              <p className="text-gray-400 text-xs font-bold flex items-center gap-1 mb-3">最近记录</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {narrativeHistory.slice(0, 5).map((n, i) => (
                  <p key={i} className="text-gray-400 text-xs border-b border-[#EADCD0] pb-1 last:border-0">{n.title}</p>
                ))}
              </div>
            </div>
          )}

          <MemoryPanel cultivatorId={cultivator.id} entries={memoryEntries} onEntriesChange={setMemoryEntries} />

          {isAwake && (
            <button onClick={() => setTechniquePanelOpen(true)} className="w-full flex items-center gap-2 text-xs bg-white border border-[#EADCD0] rounded-lg px-3 py-2 hover:bg-[#FDF2F0] hover:border-[#B83227] transition-colors text-[#2C1E1E]">
              📖 功法
            </button>
          )}
        </section>
      </div>

      <TechniquePanel cultivatorId={cultivator.id} open={techniquePanelOpen} onOpenChange={setTechniquePanelOpen} />

      {daoXiao && (
        <DaoXiaoModal open={true} cultivatorName={daoXiao.name} userId={cultivator.id} summary={daoXiao.summary} onClose={() => setDaoXiao(null)} />
      )}

      {warnEarly && (
        <div className="fixed bottom-20 left-4 right-4 max-w-lg mx-auto z-50">
          <div className="bg-[#FDF2F0] border border-[#B83227]/30 rounded-lg p-3 shadow-lg">
            <p className="text-[#B83227] text-sm font-medium">⚠️ 大限将至</p>
            <p className="text-[#7A1F18] text-xs mt-1">仅剩 {remaining} 年寿元。突破境界可延年益寿。</p>
            <button onClick={() => setWarnEarly(false)} className="text-[#B83227] text-xs underline mt-1">知晓了</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .silk-card { background-color: #FFFFFF; border: 1px solid #EADCD0; box-shadow: 0 4px 20px -2px rgba(122, 31, 24, 0.05); transition: all 0.25s ease; }
        .silk-card:hover { box-shadow: 0 8px 25px -2px rgba(122, 31, 24, 0.1); border-color: rgba(184, 50, 39, 0.35); }
        .vermilion-progress-solid { background-color: #B83227; }
        .nav-tag { transition: all 0.2s ease; }
        .nav-tag.active { background-color: #B83227 !important; color: #FFFFFF !important; border-color: #B83227 !important; transform: translateY(-2px); box-shadow: 0 4px 10px rgba(184, 50, 39, 0.25); }
        .calligraphy { font-family: 'Ma Shan Zheng', 'STKaiti', 'KaiTi', '楷体', '华文行楷', cursive, serif; }
        @keyframes sealDrop { 0% { transform: scale(1.4) rotate(8deg); opacity: 0; } 100% { transform: scale(1) rotate(-3deg); opacity: 0.95; } }
        .seal-mark { animation: sealDrop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.2) forwards; }
      `}</style>
    </main>
  );
}
