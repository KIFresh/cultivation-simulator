"use client";

import { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toPng, toBlob } from "html-to-image";
import { toast } from "sonner";

// ────────────────────────────────────────────────
// 突破分享卡片
// 版式严格照搬 项目资料/设计稿-分享卡片/_compose_card.py（360×480，3:4）
// 仅 筑基/结丹/元婴 三个境界有卡片素材
// ────────────────────────────────────────────────

export interface BreakthroughCardData {
  name: string;            // 道号
  spiritualRoot: string;   // 灵根
  realm: string;           // 新境界，如「筑基期」
  fromRealm: string;       // 上一境界
  createdAt: string;       // 用于算修炼天数
  totalExp: number;        // 累计修为
  breakthroughCount: number;
}

const REALM_CARD: Record<string, { bg: string; zi: string; quote: string }> = {
  筑基期: { bg: "/cards/bg-zhuji.png", zi: "/cards/zi-zhuji.png", quote: "灵台清明根基已固" },
  结丹期: { bg: "/cards/bg-jiedan.png", zi: "/cards/zi-jiedan.png", quote: "百炼成丹金光内蕴" },
  元婴期: { bg: "/cards/bg-yuanying.png", zi: "/cards/zi-yuanying.png", quote: "元神出窍神游太虚" },
};

/** 该境界是否有突破卡片素材 */
export function hasBreakthroughCard(realm: string): boolean {
  return realm in REALM_CARD;
}

const W = 360;
const H = 480;

const fmtNum = (n: number) =>
  n > 9999 ? (n / 10000).toFixed(1).replace(/\.0$/, "") + "w" : String(n);

const FONT_DAO = '"STXingkai","华文行楷","KaiTi",serif';
const FONT_KAI = '"KaiTi","STKaiti","楷体",serif';
const FONT_SONG = '"STZhongsong","中宋","SimSun",serif';
const FONT_NUM = '"Microsoft YaHei","微软雅黑",sans-serif';

export default function BreakthroughCard({
  data,
  onClose,
}: {
  data: BreakthroughCardData | null;
  onClose: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<null | string>(null);

  // data 为 null 时不渲染；AnimatePresence 负责进出动画
  const cfg = data ? REALM_CARD[data.realm] : undefined;

  const [days, setDays] = useState(1);

  useEffect(() => {
    if (data) {
      setDays(Math.max(1, Math.floor((Date.now() - new Date(data.createdAt).getTime()) / 86400000)));
    }
  }, [data]);
  const dao = data ? (data.name.length > 8 ? data.name.slice(0, 8) + "…" : data.name) : "";
  const fromShort = data ? data.fromRealm.replace("期", "") : "";
  const toShort = data ? data.realm.replace("期", "") : "";
  const shareText = `苦修${days}日，终破${fromShort}，踏入${toShort}！⚡  #修仙模拟器# #凡人修仙传#`;

  const capture = async () => {
    if (!cardRef.current) return null;
    await document.fonts.ready;
    return cardRef.current;
  };

  const handleSave = async () => {
    const node = await capture();
    if (!node) return;
    setBusy("正在镌刻仙箓…");
    try {
      const url = await toPng(node, { pixelRatio: 2, cacheBust: true });
      const a = document.createElement("a");
      a.download = `修仙模拟器-${toShort}-${dao}.png`;
      a.href = url;
      a.click();
      toast.success("已保存图片");
    } catch {
      toast.error("保存失败，可长按卡片保存到相册");
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    const node = await capture();
    if (!node) return;
    setBusy("正在镌刻仙箓…");
    try {
      const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true });
      if (!blob) throw new Error("blob null");
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast.success("已复制图片");
    } catch {
      toast.error("复制失败，可长按卡片保存到相册");
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    const node = await capture();
    if (!node) return;
    setBusy("正在镌刻仙箓…");
    try {
      const blob = await toBlob(node, { pixelRatio: 2, cacheBust: true });
      const file = blob ? new File([blob], "card.png", { type: "image/png" }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
      } else if (navigator.share) {
        await navigator.share({ text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        toast.success("已复制分享文案");
      }
    } catch {
      // 用户取消或不支持，静默
    } finally {
      setBusy(null);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      toast.success("文案已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  const stats = data
    ? [
        { x: 81, n: String(days), l: "修炼天数" },
        { x: 158, n: fmtNum(data.totalExp), l: "累计修为" },
        { x: 236, n: String(data.breakthroughCount), l: "突破次数" },
      ]
    : [];

  return (
    <AnimatePresence>
      {data && cfg && (
        <motion.div
          key="bt-overlay"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-y-auto py-8"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(20,10,0,0.85) 0%, rgba(0,0,0,0.96) 100%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          onClick={onClose}
        >
          {/* 顶部标签 */}
          <motion.div
            className="mb-4 select-none"
            style={{ color: "#ffcc66", fontSize: 13, letterSpacing: "0.5em", fontFamily: FONT_KAI }}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            ⚡ 天 道 见 证 · 突 破 成 功 ⚡
          </motion.div>

          {/* 卡片 + 光环（缩放包裹，适配窄屏） */}
          <div
            className="relative shrink-0"
            style={{
              width: W,
              height: H,
              transform: "scale(min(1, calc((100vw - 32px) / 360)))",
              transformOrigin: "top center",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 金色光环 */}
            <div
              className="pointer-events-none absolute"
              style={{
                top: "44%",
                left: "50%",
                width: 460,
                height: 460,
                background:
                  "radial-gradient(circle, rgba(255,170,40,0.28) 0%, transparent 60%)",
                animation: "bt-glow 2.5s ease-in-out infinite",
                zIndex: 0,
              }}
            />

            {/* 卡片本体（导出节点） */}
            <motion.div
              ref={cardRef}
              className="relative overflow-hidden"
              style={{
                width: W,
                height: H,
                zIndex: 1,
                borderRadius: 14,
                backgroundImage: `url(${cfg.bg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                boxShadow: "0 12px 50px rgba(255,150,30,0.25)",
                border: "1.5px solid rgba(201,165,92,0.55)",
              }}
              initial={{ opacity: 0, scale: 0.7, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 10 }}
              transition={{ duration: 0.8, ease: [0.2, 0.9, 0.3, 1.2] }}
            >
              {/* 底部压暗 */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.88) 100%)",
                }}
              />

              {/* 境界字 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cfg.zi}
                alt={toShort}
                style={{
                  position: "absolute",
                  top: "60%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                  height: 59,
                  filter: "drop-shadow(0 0 14px rgba(255,150,20,0.45))",
                  zIndex: 2,
                }}
              />

              {/* 道号 */}
              <div
                style={{
                  position: "absolute",
                  top: 362,
                  left: 0,
                  right: 0,
                  transform: "translateY(-50%)",
                  textAlign: "center",
                  fontSize: 27,
                  color: "#FFE096",
                  fontFamily: FONT_DAO,
                  letterSpacing: "0.16em",
                  textShadow: "2px 2px 5px rgba(0,0,0,0.85)",
                  zIndex: 2,
                }}
              >
                {dao}
              </div>

              {/* 灵根 · 感言 */}
              <div
                style={{
                  position: "absolute",
                  top: 391,
                  left: 0,
                  right: 0,
                  transform: "translateY(-50%)",
                  textAlign: "center",
                  fontSize: 12,
                  color: "#F5F5F5",
                  fontFamily: FONT_KAI,
                  letterSpacing: "0.04em",
                  textShadow: "1px 1px 3px rgba(0,0,0,0.85)",
                  zIndex: 2,
                }}
              >
                {data.spiritualRoot}　·　{cfg.quote}
              </div>

              {/* 分隔线 */}
              <div
                style={{
                  position: "absolute",
                  top: 406,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 216,
                  height: 2,
                  background: "rgba(255,255,255,0.31)",
                  zIndex: 2,
                }}
              />

              {/* 三栏数据 */}
              {stats.map((s) => (
                <div key={s.l}>
                  <div
                    style={{
                      position: "absolute",
                      top: 427,
                      left: s.x,
                      transform: "translate(-50%,-50%)",
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#FFE096",
                      fontFamily: FONT_NUM,
                      textShadow: "1px 1px 3px rgba(0,0,0,0.85)",
                      zIndex: 2,
                    }}
                  >
                    {s.n}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      top: 447,
                      left: s.x,
                      transform: "translate(-50%,-50%)",
                      fontSize: 10,
                      color: "#CDCDCD",
                      fontFamily: FONT_SONG,
                      letterSpacing: "0.05em",
                      textShadow: "1px 1px 2px rgba(0,0,0,0.85)",
                      zIndex: 2,
                    }}
                  >
                    {s.l}
                  </div>
                </div>
              ))}

              {/* 栏间竖线 */}
              {[120, 197].map((x) => (
                <div
                  key={x}
                  style={{
                    position: "absolute",
                    top: 417,
                    left: x,
                    width: 1,
                    height: 36,
                    background: "rgba(255,255,255,0.25)",
                    zIndex: 2,
                  }}
                />
              ))}

              {/* 右下角网址胶囊 */}
              <div
                style={{
                  position: "absolute",
                  right: 12,
                  bottom: 12,
                  padding: "5px 10px",
                  background: "rgba(0,0,0,0.63)",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                  fontFamily: FONT_NUM,
                  zIndex: 2,
                }}
              >
                B站搜：修仙模拟器
              </div>

              {/* 金色光点 */}
              {[
                { left: "18%", top: "20%", delay: "0s" },
                { left: "78%", top: "26%", delay: "1s" },
                { left: "64%", top: "58%", delay: "2s" },
              ].map((p, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    left: p.left,
                    top: p.top,
                    width: 3,
                    height: 3,
                    borderRadius: "50%",
                    background: "#ffcc66",
                    boxShadow: "0 0 6px #ffaa33",
                    animation: `bt-spark 3s ease-in-out ${p.delay} infinite`,
                    zIndex: 2,
                  }}
                />
              ))}

              {/* 生成中 loading */}
              {busy && (
                <div
                  className="absolute inset-0 flex items-center justify-center"
                  style={{ background: "rgba(0,0,0,0.55)", zIndex: 5, fontFamily: FONT_KAI }}
                >
                  <span style={{ color: "#FFE096", fontSize: 15, letterSpacing: "0.2em" }}>
                    {busy}
                  </span>
                </div>
              )}
            </motion.div>
          </div>

          {/* 分享操作栏（不属于导出图片） */}
          <motion.div
            className="mt-5 w-[320px] max-w-[88vw]"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <div className="flex gap-2.5">
              <button
                onClick={handleSave}
                disabled={!!busy}
                className="flex-1 rounded-[10px] py-2.5 text-sm font-bold disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#c9a55c,#b08a40)", color: "#1a1206" }}
              >
                💾 保存图片
              </button>
              <button
                onClick={handleCopy}
                disabled={!!busy}
                className="flex-1 rounded-[10px] py-2.5 text-sm disabled:opacity-50"
                style={{
                  background: "rgba(201,165,92,0.12)",
                  border: "1px solid rgba(201,165,92,0.3)",
                  color: "#e0c884",
                }}
              >
                📋 复制图片
              </button>
              <button
                onClick={handleShare}
                disabled={!!busy}
                className="flex-1 rounded-[10px] py-2.5 text-sm disabled:opacity-50"
                style={{
                  background: "rgba(201,165,92,0.12)",
                  border: "1px solid rgba(201,165,92,0.3)",
                  color: "#e0c884",
                }}
              >
                🔗 分享
              </button>
            </div>

            <div
              className="relative mt-3 rounded-[10px] px-3 py-2.5 text-xs leading-relaxed"
              style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.08)", color: "#9a8a6a" }}
            >
              <button
                onClick={handleCopyText}
                className="absolute right-2 top-2 rounded-md px-2 py-0.5 text-[10px]"
                style={{ color: "#c9a55c", border: "1px solid rgba(201,165,92,0.3)" }}
              >
                复制文案
              </button>
              <span className="pr-16 inline-block">
                苦修{days}日，终破{fromShort}，踏入{toShort}！⚡
                <br />
                <span style={{ color: "#6a8ab8" }}>#修仙模拟器# #凡人修仙传#</span>
              </span>
            </div>

            <p className="mt-2 text-center text-[11px]" style={{ color: "#6a6a6a" }}>
              保存失败可长按上方卡片保存到相册
            </p>
            <p className="mt-3 text-center text-[11px]" style={{ color: "#5a5a5a" }}>
              点击空白处关闭 · 继续修炼
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
