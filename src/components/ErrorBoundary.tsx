import React from 'react'

interface Props {
  children: React.ReactNode
  fallbackLabel?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border border-rule bg-paper-alt p-6">
          <p className="font-sans text-xs uppercase tracking-wider text-ink-muted mb-1">
            {this.props.fallbackLabel || 'Chart'} unavailable
          </p>
          <p className="font-mono text-xs text-ink-muted">
            {this.state.error?.message || 'Render error'}
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
