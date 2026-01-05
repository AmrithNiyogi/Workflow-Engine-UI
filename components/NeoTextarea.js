'use client';

import { forwardRef } from 'react';

const NeoTextarea = forwardRef(function NeoTextarea({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  rows = 4,
  className = '',
  ...props
}, ref) {
  return (
    <div className="mb-4">
      {label && (
        <label className="block font-bold text-black mb-2">
          {label} {required && <span className="text-[#FFB6C1]">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className={`w-full px-4 py-2 border-4 border-black bg-[#FFF8DC] text-black font-semibold focus:outline-none focus:ring-4 focus:ring-[#87CEEB] resize-y ${className}`}
        {...props}
      />
    </div>
  );
});

export default NeoTextarea;

