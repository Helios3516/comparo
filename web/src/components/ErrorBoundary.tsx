import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="font-serif text-3xl">Comparo a rencontré un problème.</p>
        <p className="mt-3 text-sm text-muted">La page n’a pas pu s’afficher. Recharger remet le catalogue en place.</p>
        <button type="button" onClick={() => window.location.reload()} className="btn-solid mt-6 rounded-full px-5 py-2.5 text-sm font-medium">
          Recharger
        </button>
      </div>
    );
  }
}
