"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CompetitionResult, FinalExamResult } from "@/store/game-store";

interface CompetitionResultModalProps {
  competitionResults: CompetitionResult[] | null;
  finalExamResult: FinalExamResult | null;
  onClose: () => void;
}

export default function CompetitionResultModal({
  competitionResults,
  finalExamResult,
  onClose,
}: CompetitionResultModalProps) {
  const open = Boolean(competitionResults && competitionResults.length > 0) || Boolean(finalExamResult);
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl">🏆 学期竞赛结果</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {competitionResults?.map((sem) => (
            <div key={sem.semester} className="bg-muted rounded-lg p-3 text-sm space-y-2">
              <p className="font-bold text-[var(--destructive)]">{sem.semester}</p>
              {sem.events.map((ev) => (
                <div key={ev.id} className="space-y-1">
                  <p className="font-medium">📚 {ev.subjectName}</p>
                  <p className="text-xs text-muted-foreground">
                    {ev.prizes
                      .map(
                        (p) =>
                          `${p.name}（学科+${p.subjectExp} 悟性+${p.insightExp} 魅力+${p.charmExp}）`
                      )
                      .join("　")}
                  </p>
                </div>
              ))}
            </div>
          ))}
          {finalExamResult && (
            <div className="bg-muted rounded-lg p-3 text-sm space-y-1">
              <p className="font-bold text-[var(--destructive)]">📝 期末考</p>
              <p className="text-muted-foreground">{finalExamResult.text}</p>
              <p className="text-xs">
                {finalExamResult.subject} 学科经验 <strong>+{finalExamResult.gained}</strong>
              </p>
            </div>
          )}
          <Button className="w-full" onClick={onClose}>
            收下奖励
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
