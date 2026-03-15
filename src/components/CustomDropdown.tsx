import { useEffect, useRef } from 'react';
import { FiChevronDown } from 'react-icons/fi';

interface CustomDropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomDropdownOption[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  placeholder?: string;
  className?: string;
}

const CustomDropdown = ({
  label,
  value,
  onChange,
  options,
  isOpen,
  setIsOpen,
  placeholder = 'Select option',
  className = '',
}: CustomDropdownProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {label && (
        <label className="text-xs uppercase tracking-wide text-zinc-500 mb-2 block">{label}</label>
      )}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/60 hover:bg-white/10 transition-colors flex items-center justify-between gap-2 overflow-hidden"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <FiChevronDown className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-zinc-900 border border-white/10 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors ${
                value === option.value ? 'bg-cyan-500/20 text-cyan-300' : 'text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
