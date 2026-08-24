import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AppErrorBoundaryProps {
  children: ReactNode;
  label?: string;
  resetKey?: string;
  onReset?: () => void;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Erro inesperado ao renderizar a tela.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary]', this.props.label || 'Tela', error, errorInfo);
  }

  componentDidUpdate(prevProps: AppErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: undefined });
    }
  }

  private handleRetry = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, message: undefined });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-[calc(100vh-120px)] items-center justify-center bg-[#060b16] px-6 text-white">
        <div className="w-full max-w-xl rounded-lg border border-red-500/25 bg-[#0b1220] p-8 text-center shadow-2xl shadow-red-950/20">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-300">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-semibold">
            Nao foi possivel carregar esta tela
          </h2>
          <p className="mt-3 text-sm leading-6 text-blue-200/80">
            O sistema encontrou um erro ao aplicar a acao atual. Tente novamente sem precisar fechar o projeto.
          </p>
          {this.state.message ? (
            <p className="mt-4 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-xs text-blue-100/70">
              {this.state.message}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={this.handleRetry} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Tentar novamente
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
              className="gap-2 border-white/15 bg-transparent text-white hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              Recarregar tela
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
