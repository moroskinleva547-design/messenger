import { motion } from 'framer-motion';
import { useState } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  containerClassName?: string;
}

export function Input({ label, error, icon, containerClassName = '', className = '', ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className={`space-y-1 ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            {icon}
          </div>
        )}
        <motion.div
          animate={{
            boxShadow: focused
              ? '0 0 0 2px rgba(99, 102, 241, 0.3), 0 1px 2px rgba(0,0,0,0.05)'
              : '0 1px 2px rgba(0,0,0,0.05)',
          }}
          transition={{ duration: 0.2 }}
          className="rounded-xl"
        >
          <input
            className={`w-full px-4 py-2.5 ${icon ? 'pl-10' : ''} bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none transition-colors duration-200 ${error ? 'border-red-400 dark:border-red-500' : ''} ${className}`}
            onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
            {...props}
          />
        </motion.div>
      </div>
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-red-500"
        >
          {error}
        </motion.p>
      )}
    </div>
  );
}
