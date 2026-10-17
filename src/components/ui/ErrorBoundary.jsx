import { Component } from 'react'
import Button from './Button.jsx'
import Card from './Card.jsx'
import Icon from './Icon.jsx'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '24px' }}>
          <Card style={{ maxWidth: '520px', width: '100%', textAlign: 'center', padding: '36px 24px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(155, 27, 43, 0.1)', color: '#9b1b2b', marginBottom: '16px' }}>
              <Icon name="alert-triangle" size={28} />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px', color: 'var(--color-text, #1e293b)' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--color-text-muted, #64748b)', fontSize: '0.95rem', marginBottom: '24px', lineHeight: 1.5 }}>
              An error occurred while loading this section. You can try refreshing the page or navigating back.
            </p>
            {this.state.error?.message && (
              <pre style={{ textAlign: 'left', background: 'rgba(0,0,0,0.04)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', color: '#b91c1c', overflowX: 'auto', marginBottom: '24px', whiteSpace: 'pre-wrap' }}>
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button onClick={this.handleReload} variant="primary">
                Reload Page
              </Button>
              <Button onClick={() => { window.location.href = '/' }} variant="secondary">
                Go to Home
              </Button>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
