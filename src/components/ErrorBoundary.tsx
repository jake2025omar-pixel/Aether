import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('ErrorBoundary caught an error:', error.message, errorInfo.componentStack);
    }
  }

  private handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#07050D] text-white font-sans">
          <div className="max-w-md w-full p-6 sm:p-8 crystal-surface rounded-3xl text-center border border-white/[0.1]">
            <div className="w-12 h-12 rounded-2xl bg-purple-900/30 text-purple-400 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-light tracking-wide text-white mb-2">
              An unexpected error occurred
            </h2>

            <p className="text-sm text-white/50 mb-6 leading-relaxed">
              Aether encountered an issue while loading. You can reload to continue safely.
            </p>

            <button
              onClick={this.handleReload}
              className="w-full py-3 px-5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-600/30 active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
