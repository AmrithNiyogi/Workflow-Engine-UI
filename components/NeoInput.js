'use client';

export default function NeoInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
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
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className={`w-full px-4 py-2 border-4 border-black bg-[#FFF8DC] text-black font-semibold focus:outline-none focus:ring-4 focus:ring-[#87CEEB] ${className}`}
        {...props}
      />
    </div>
  );
}

