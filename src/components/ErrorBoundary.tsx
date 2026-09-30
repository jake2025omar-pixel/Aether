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
    // In production, internal stack traces and server details are strictly omitted from UI
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
        <div className="min-h-screen w-full flex items-center justify-center p-6 bg-[#FFFCF5] text-slate-800 font-sans" dir="rtl">
          <div className="max-w-md w-full p-6 sm:p-8 bg-white border border-[#EFECE6] rounded-3xl shadow-xl text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h2 className="text-xl font-extrabold text-slate-900 mb-2">
              حدث خطأ غير متوقع
            </h2>

            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              واجه التطبيق مشكلة أثناء معالجة الصفحة. يمكنك إعادة التحميل للمتابعة بأمان.
            </p>

            <button
              onClick={this.handleReload}
              className="w-full py-3 px-5 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#7C3AED]/20 active:scale-98"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة تحميل التطبيق</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
