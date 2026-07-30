// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DaoXiaoModal from "@/components/dao-xiao-modal";

const mockReplace = vi.fn();
const mockOnClose = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-title">{children}</div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick} data-testid="close-button">
      {children}
    </button>
  ),
}));

const defaultSummary = {
  age: 120,
  realm: "金丹期",
  realmLevel: 5,
  breakthroughCount: 3,
  reincarnationCount: 0,
  totalExp: 15000,
};

describe("DaoXiaoModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("open=true 时显示道消身殒弹窗", () => {
    render(
      <DaoXiaoModal
        open={true}
        cultivatorName="玄明"
        userId="user-1"
        summary={defaultSummary}
        onClose={mockOnClose}
      />
    );
    expect(screen.getByText("🌑 道消身殒")).toBeDefined();
    expect(screen.getByText(/玄明/)).toBeDefined();
    expect(screen.getByText(/120/)).toBeDefined();
    expect(screen.getByText((content) => content.includes("金丹期"))).toBeDefined();
  });

  it("open=false 时不渲染弹窗内容", () => {
    render(
      <DaoXiaoModal
        open={false}
        cultivatorName="玄明"
        userId="user-1"
        summary={defaultSummary}
        onClose={mockOnClose}
      />
    );
    expect(screen.queryByText("🌑 道消身殒")).toBeNull();
  });

  it("点击返回洞府按钮触发 onClose 并跳转", () => {
    render(
      <DaoXiaoModal
        open={true}
        cultivatorName="玄明"
        userId="user-1"
        summary={defaultSummary}
        onClose={mockOnClose}
      />
    );
    fireEvent.click(screen.getByTestId("close-button"));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/dashboard");
  });
});
