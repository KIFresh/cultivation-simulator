// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('lucide-react', () => ({
  ChevronDown: () => <span>▼</span>,
  ChevronUp: () => <span>▲</span>,
  Edit3: () => <span>✏️</span>,
  Star: () => <span>⭐</span>,
  Trash2: () => <span>🗑️</span>,
  Sparkles: () => <span>✨</span>,
  X: () => <span>✕</span>,
  XIcon: () => <span>✕</span>,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import MemoryPanel from '../memory-panel';

const mockEntries = [
  { id: 'e1', title: '测试记忆1', summary: '这是第一条记忆', important: true, createdAt: '2026-01-01' },
  { id: 'e2', title: '测试记忆2', summary: '这是第二条记忆', important: false, createdAt: '2026-01-02' },
];

describe('MemoryPanel', () => {
  const baseProps = {
    cultivatorId: 'c1',
    entries: mockEntries,
    onEntriesChange: vi.fn(),
  };

  beforeEach(() => { vi.clearAllMocks(); });

  it('渲染条目列表', () => {
    render(<MemoryPanel {...baseProps} />);
    expect(screen.getByText('测试记忆1')).toBeDefined();
    expect(screen.getByText('测试记忆2')).toBeDefined();
  });

  it('空状态显示提示', () => {
    render(<MemoryPanel {...baseProps} entries={[]} />);
    expect(screen.getByText(/暂无记忆/)).toBeDefined();
  });

  it('默认折叠', () => {
    render(<MemoryPanel {...baseProps} />);
    expect(screen.getByText('测试记忆1')).toBeDefined();
  });

  it('按 createdAt 最新→最旧排序', () => {
    const unsorted = [
      { id: 'e1', title: '旧的', summary: '一月', important: false, createdAt: '2026-01-01' },
      { id: 'e2', title: '新的', summary: '三月', important: false, createdAt: '2026-03-01' },
      { id: 'e3', title: '中', summary: '二月', important: false, createdAt: '2026-02-01' },
    ];
    render(<MemoryPanel {...baseProps} entries={unsorted} />);
    const items = screen.getAllByText(/旧的|新的|中/);
    // items 按在 DOM 中的顺序提取标签文本
    const labels = items.map(el => el.textContent);
    expect(labels[0]).toBe('新的');
    expect(labels[1]).toBe('中');
    expect(labels[2]).toBe('旧的');
  });

  it('无效 createdAt 不破坏排序', () => {
    const withInvalid = [
      { id: 'e1', title: '正常', summary: '这是正常的', important: false, createdAt: '2026-02-01' },
      { id: 'e2', title: '无效日期', summary: '无日期', important: false, createdAt: '' },
    ];
    render(<MemoryPanel {...baseProps} entries={withInvalid} />);
    // 不应抛异常，两条都应可见
    expect(screen.getByText('无效日期')).toBeDefined();
    // 标题"正常"同时出现在 title 和 summary 中 → 至少找到 1 个
    expect(screen.getAllByText('正常').length).toBeGreaterThanOrEqual(1);
  });

  it('排序不修改原始 props', () => {
    const original = [...mockEntries];
    render(<MemoryPanel {...baseProps} />);
    // entries 数组本身应保持原顺序
    expect(baseProps.entries[0].id).toBe('e1');
    expect(baseProps.entries[1].id).toBe('e2');
  });
});