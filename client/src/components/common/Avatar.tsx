import { motion } from 'framer-motion';
import { getInitials } from '@/utils/format';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away';
  className?: string;
}

const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-lg' };
const dotSizes = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3 h-3', xl: 'w-3.5 h-3.5' };
const statusColors = { online: 'bg-emerald-500', offline: 'bg-gray-400', away: 'bg-amber-400' };

export function Avatar({ src, name, size = 'md', status, className = '' }: AvatarProps) {
  return (
    <motion.div
      className={`relative shrink-0 ${sizes[size]} ${className}`}
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 300, damping: 15 }}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full rounded-full object-cover" loading="lazy" />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold">
          {getInitials(name)}
        </div>
      )}
      {status && (
        <span
          className={`absolute bottom-0 right-0 ${dotSizes[size]} rounded-full border-2 border-white dark:border-gray-900 ${statusColors[status]}`}
        />
      )}
    </motion.div>
  );
}
