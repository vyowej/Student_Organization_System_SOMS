export default function LoadingState({ message = 'Loading, please wait…' }) {
  return (
    <div aria-live="polite" className="loading-state" role="status">
      <span aria-hidden="true" className="spinner" />
      <p>{message}</p>
    </div>
  )
}
