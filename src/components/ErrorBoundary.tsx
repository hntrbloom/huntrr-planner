import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const needsReload = /dynamically imported module|loading chunk|importing a module script|failed to fetch.*module/i.test(this.state.error?.message || '');
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-error/5 text-center min-h-[50vh] rounded-3xl m-4 md:m-8">
          <AlertTriangle className="w-16 h-16 text-error mb-4" />
          <h2 className="text-2xl font-bold text-on-surface mb-2">Something went wrong</h2>
          <p className="text-on-surface-variant max-w-md mb-6 whitespace-pre-wrap text-sm">
            {needsReload ? 'A newer version of this website is available. Reload to continue. Your saved records will remain available.' : this.state.error?.message || 'An unexpected error occurred in this view.'}
          </p>
          <button
            onClick={() => needsReload ? window.location.reload() : this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-bold hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
            {needsReload ? 'Reload website' : 'Try Again'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
