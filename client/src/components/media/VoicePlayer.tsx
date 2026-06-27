import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface VoicePlayerProps {
  src: string;
  duration?: number;
}

export function VoicePlayer({ src, duration: propDuration }: VoicePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(propDuration || 0);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>();

  const generateWaveform = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const bars = 48;
    const barW = w / bars - 1;
    ctx.clearRect(0, 0, w, h);

    const progress = duration > 0 ? currentTime / duration : 0;
    const playedBars = Math.floor(progress * bars);

    for (let i = 0; i < bars; i++) {
      const barH = (Math.sin(i * 0.5) * 0.4 + 0.5 + Math.random() * 0.1) * h * 0.8;
      const x = i * (barW + 1);
      const y = (h - barH) / 2;
      const isPlayed = i <= playedBars;
      ctx.fillStyle = isPlayed ? '#6366f1' : '#c7d2fe';
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, barW / 2);
      ctx.fill();
    }
  }, [currentTime, duration]);

  useEffect(() => {
    generateWaveform();
  }, [generateWaveform, currentTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoad = () => setDuration(audio.duration);
    const onEnd = () => { setPlaying(false); setCurrentTime(0); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onLoad);
    audio.addEventListener('ended', onEnd);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onLoad);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      cancelAnimationFrame(animRef.current!);
    } else {
      audio.play();
      animate();
    }
    setPlaying(!playing);
  };

  const animate = () => {
    generateWaveform();
    animRef.current = requestAnimationFrame(animate);
  };

  const changeSpeed = () => {
    const speeds = [1, 1.5, 2];
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-2xl min-w-[200px]">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={togglePlay}
        className="p-2 rounded-full bg-primary-500 text-white shrink-0"
      >
        {playing ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" className="ml-0.5" />}
      </motion.button>

      <canvas ref={canvasRef} className="flex-1 h-8 rounded" />

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={changeSpeed}
          className="text-[10px] font-bold text-primary-500 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded"
        >
          {speed}x
        </button>
        <span className="text-[10px] text-gray-500 w-8 text-right">
          {formatTime(currentTime)}/{formatTime(duration)}
        </span>
      </div>

      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}
