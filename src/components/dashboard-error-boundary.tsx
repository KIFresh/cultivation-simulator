"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface DashboardErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface DashboardErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * 仪表盘级错误边界：捕获任意子面板渲染期间的异常，
 * 仅就地降级展示，不阻断其余面板与整体交互。
 * 生产环境只显示通用文案；开发环境保留诊断信息。
 */
export default class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  constructor(props: DashboardErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[DashboardErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = typeof window !== "undefined" && !!window.__NEXT_DATA__?.props?.pageProps?.__DEV__;

    return (
      <div className="border border-red-300 bg-red-50 rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          <p className="text-sm font-medium">
            {this.props.fallbackTitle ?? "面板加载出错"}
          </p>
        </div>
        {this.state.error?.message && isDev && (
          <p className="text-xs text-red-600 break-words">
            {this.state.error.message}
          </p>
        )}
        <button
          type="button"
          onClick={this.handleReset}
          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          重试
        </button>
      </div>
    );
  }
}
