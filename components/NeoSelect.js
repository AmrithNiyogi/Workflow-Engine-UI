'use client';

export default function NeoSelect({
  label,
  value,
  onChange,
  options,
  required = false,
  className = '',
  ...props
}) {
  return (
    <div className="mb-4">
      {label && (
        <label className="block font-bold text-black mb-2">
          {label} {required && <span className="text-[#FFB6C1]">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        required={required}
        className={`w-full px-4 py-2 border-4 border-black bg-[#FFF8DC] text-black font-semibold focus:outline-none focus:ring-4 focus:ring-[#87CEEB] ${className}`}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

