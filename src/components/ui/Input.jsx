export default function Input({ label, id, className = '', ...props }) {
  return (
    <div className="form-field">
      {label && <label htmlFor={id}>{label}</label>}
      <input className={`input ${className}`.trim()} id={id} {...props} />
    </div>
  )
}
