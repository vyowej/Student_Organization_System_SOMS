export default function Input({ label, id, className = '', fieldClassName = '', ...props }) {
  return (
    <div className={`form-field ${fieldClassName}`.trim()}>
      {label && <label htmlFor={id}>{label}</label>}
      <input className={`input ${className}`.trim()} id={id} {...props} />
    </div>
  )
}
