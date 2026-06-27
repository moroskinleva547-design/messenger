import { useState } from 'react';
import { motion } from 'framer-motion';
import { useUiStore } from '@/stores/uiStore';
import { ImageIcon, Film } from 'lucide-react';
import type { Message } from '@/types';
import { MediaSkeleton } from '@/components/common/Skeleton';

interface MediaGalleryProps {
  messages: Message[];
  loading?: boolean;
}

export function MediaGallery({ messages, loading }: MediaGalleryProps) {
  const { setShowImagePreview } = useUiStore();
  const mediaMessages = messages.filter(
    (m) => (m.type === 'image' || m.type === 'voice') && m.media_url && !m.deleted_at
  );
  const images = mediaMessages.filter((m) => m.type === 'image');

  if (loading) return <MediaSkeleton />;

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <ImageIcon size={32} className="mb-2 opacity-50" />
        <p className="text-sm">No media yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-1">
      {images.map((msg, i) => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          className="aspect-square rounded-lg overflow-hidden cursor-pointer relative group"
          onClick={() => setShowImagePreview(msg.media_url)}
        >
          <img
            src={msg.media_url}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </motion.div>
      ))}
    </div>
  );
}
