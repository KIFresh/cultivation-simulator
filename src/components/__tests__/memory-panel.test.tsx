// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => {
  const Link = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  );
  return { default: Link };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MemoryPanel from "../memory-panel";

const mockEntries = [
  { id: "e1", title: "测试记忆1", summary: "这是第一条记忆", important: true, cultivatorAge: 2, cultivatorRealm: "凡人", createdAt: "2026-01-01" },
  { id: "e2", title: "测试记忆2", summary: "这是第二条记忆", important: false, cultivatorAge: 3, cultivatorRealm: "凡人", createdAt: "2026-01-02" },
];

describe("MemoryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: mockEntries }),
    });
  });

  it("加载后渲染最近记忆（title + summary）", async () => {
    render(<MemoryPanel cultivatorId="c1" />);
    await waitFor(() => expect(screen.getByText(/测试记忆1/)).toBeDefined());
    expect(screen.getByText("这是第一条记忆")).toBeDefined();
    expect(screen.getByText(/测试记忆2/)).toBeDefined();
  });

  it("空状态显示提示", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entries: [] }),
    });
    render(<MemoryPanel cultivatorId="c1" />);
    await waitFor(() => expect(screen.getByText(/暂无记忆/)).toBeDefined());
  });

  it("点击折叠后隐藏内容", async () => {
    render(<MemoryPanel cultivatorId="c1" />);
    await waitFor(() => expect(screen.getByText(/测试记忆1/)).toBeDefined());
    screen.getByText("▼").click();
    await waitFor(() => expect(screen.queryByText(/测试记忆1/)).toBeNull());
  });

  it("存在记忆时显示跳转入口", async () => {
    render(<MemoryPanel cultivatorId="c1" />);
    await waitFor(() => expect(screen.getByText(/查看全部记忆/)).toBeDefined());
  });
});
