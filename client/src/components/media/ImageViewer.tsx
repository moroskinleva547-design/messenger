import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUiStore } from '@/stores/uiStore';
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

export function ImageViewer() {
  const { showImagePreview, setShowImagePreview } = useUiStore();
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.max(0.5, Math.min(5, s - e.deltaY * 0.01)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };

  const handleMouseUp = () => { isDragging.current = false; };

  const reset = () => { setScale(1); setRotation(0); setPosition({ x: 0, y: 0 }); };

  return (
    <AnimatePresence>
      {showImagePreview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onWheel={handleWheel}
        >
          <div className="flex items-center justify-between p-4 z-10">
            <div className="flex items-center gap-2">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setScale((s) => Math.min(5, s + 0.5))} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <ZoomIn size={20} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setScale((s) => Math.max(0.5, s - 0.5))} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <ZoomOut size={20} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setRotation((r) => r + 90)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <RotateCw size={20} />
              </motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={reset} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs">
                Reset
              </motion.button>
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => { reset(); setShowImagePreview(null); }} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white">
              <X size={24} />
            </motion.button>
          </div>

          <div
            className="flex-1 flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <motion.img
              src={showImagePreview}
              alt="Preview"
              className="max-w-[90vw] max-h-[85vh] object-contain select-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              }}
              drag={false}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 20 }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
