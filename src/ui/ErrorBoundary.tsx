import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Catches a crash in one page so the rest of the app — and the user's build,
 * which is already saved — survive it.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Cyberdeck Builder crashed:', error, info.componentStack)
  }

  componentDidUpdate(prev: { resetKey?: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="panel max-w-lg p-5 space-y-3">
          <h2 className="text-title font-semibold text-severity-critical">This page crashed</h2>
          <p className="text-ui text-fg-secondary">Your build is saved in this browser. Go to another page, undo the last change, or reload.</p>
          <pre className="text-label font-mono text-fg-muted whitespace-pre-wrap bg-canvas border border-hairline p-2">{this.state.error.message}</pre>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => this.setState({ error: null })}>Try again</button>
            <button className="btn-secondary" onClick={() => location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    )
  }
}
