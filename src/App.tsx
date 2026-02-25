import { useState, useRef, useCallback, useEffect } from 'react';

// Funny sound syllables
const SOUNDS = [
  'FAAAH', 'BOING', 'SPLAT', 'WOOOP', 'BLUB',
  'PFFFT', 'HONK', 'SQUEE', 'BLOOP', 'ZOINK',
  'FWIP', 'THONK', 'WHEEE', 'BONK', 'DOINK'
];

// Sound frequencies for each syllable type
const SOUND_CONFIGS: Record<string, { freq: number; type: OscillatorType; duration: number }> = {
  'FAAAH': { freq: 220, type: 'sawtooth', duration: 0.4 },
  'BOING': { freq: 440, type: 'sine', duration: 0.3 },
  'SPLAT': { freq: 110, type: 'square', duration: 0.15 },
  'WOOOP': { freq: 330, type: 'sine', duration: 0.5 },
  'BLUB': { freq: 180, type: 'sine', duration: 0.2 },
  'PFFFT': { freq: 80, type: 'sawtooth', duration: 0.25 },
  'HONK': { freq: 260, type: 'square', duration: 0.2 },
  'SQUEE': { freq: 880, type: 'sine', duration: 0.3 },
  'BLOOP': { freq: 200, type: 'sine', duration: 0.25 },
  'ZOINK': { freq: 520, type: 'triangle', duration: 0.15 },
  'FWIP': { freq: 600, type: 'sine', duration: 0.1 },
  'THONK': { freq: 150, type: 'square', duration: 0.15 },
  'WHEEE': { freq: 660, type: 'sine', duration: 0.4 },
  'BONK': { freq: 130, type: 'triangle', duration: 0.12 },
  'DOINK': { freq: 300, type: 'sine', duration: 0.2 },
};

interface Particle {
  id: number;
  x: number;
  y: number;
  emoji: string;
  angle: number;
  velocity: number;
}

const EMOJIS = ['✨', '💫', '🌟', '⭐', '💥', '🎵', '🎶', '😂', '🤪', '😜'];

function App() {
  const [isPressed, setIsPressed] = useState(false);
  const [currentSound, setCurrentSound] = useState<string | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [wobble, setWobble] = useState({ x: 0, y: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);
  const particleIdRef = useRef(0);
  const blobRef = useRef<HTMLDivElement>(null);

  // Initialize AudioContext on first interaction
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback((soundName: string) => {
    const ctx = getAudioContext();
    const config = SOUND_CONFIGS[soundName];

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.freq, ctx.currentTime);

    // Add pitch bend for funnier effect
    if (soundName === 'FAAAH' || soundName === 'WOOOP') {
      oscillator.frequency.exponentialRampToValueAtTime(config.freq * 0.5, ctx.currentTime + config.duration);
    } else if (soundName === 'BOING' || soundName === 'WHEEE') {
      oscillator.frequency.exponentialRampToValueAtTime(config.freq * 2, ctx.currentTime + config.duration * 0.3);
      oscillator.frequency.exponentialRampToValueAtTime(config.freq * 0.7, ctx.currentTime + config.duration);
    } else if (soundName === 'SQUEE') {
      oscillator.frequency.exponentialRampToValueAtTime(config.freq * 1.5, ctx.currentTime + config.duration);
    }

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + config.duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + config.duration);
  }, [getAudioContext]);

  const spawnParticles = useCallback((clientX: number, clientY: number) => {
    const rect = blobRef.current?.getBoundingClientRect();
    if (!rect) return;

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const newParticles: Particle[] = [];
    for (let i = 0; i < 8; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x: clientX - centerX,
        y: clientY - centerY,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        angle: (Math.PI * 2 * i) / 8 + Math.random() * 0.5,
        velocity: 80 + Math.random() * 60,
      });
    }

    setParticles(prev => [...prev, ...newParticles]);

    // Clean up particles after animation
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 800);
  }, []);

  const handleInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const rect = blobRef.current?.getBoundingClientRect();
    if (rect) {
      const relX = (clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const relY = (clientY - rect.top - rect.height / 2) / (rect.height / 2);
      setWobble({ x: relX * 20, y: relY * 20 });
    }

    setIsPressed(true);
    const sound = SOUNDS[Math.floor(Math.random() * SOUNDS.length)];
    setCurrentSound(sound);
    playSound(sound);
    spawnParticles(clientX, clientY);

    setTimeout(() => {
      setIsPressed(false);
      setWobble({ x: 0, y: 0 });
    }, 150);

    setTimeout(() => {
      setCurrentSound(null);
    }, 600);
  }, [playSound, spawnParticles]);

  // Floating animation for the blob
  const [floatOffset, setFloatOffset] = useState(0);

  useEffect(() => {
    let frame: number;
    let start: number | null = null;

    const animate = (timestamp: number) => {
      if (!start) start = timestamp;
      const elapsed = timestamp - start;
      setFloatOffset(Math.sin(elapsed / 800) * 8);
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[#FFF8F0] relative overflow-hidden flex flex-col items-center justify-center p-4 selection:bg-[#FF6B4A]/30">
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Background decorative elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[5%] w-16 h-16 md:w-24 md:h-24 rounded-full bg-[#00D9C4]/20 animate-pulse" />
        <div className="absolute top-[20%] right-[10%] w-12 h-12 md:w-20 md:h-20 rounded-full bg-[#FFE066]/40 animate-bounce" style={{ animationDuration: '3s' }} />
        <div className="absolute bottom-[25%] left-[8%] w-10 h-10 md:w-16 md:h-16 rounded-full bg-[#FF6B4A]/15 animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[15%] right-[5%] w-14 h-14 md:w-20 md:h-20 rounded-full bg-[#A78BFA]/20 animate-bounce" style={{ animationDuration: '4s' }} />
      </div>

      {/* Title */}
      <div className="text-center mb-8 md:mb-12 relative z-10">
        <h1
          className="text-4xl md:text-6xl lg:text-7xl font-bold text-[#FF6B4A] tracking-tight"
          style={{
            fontFamily: "'Baloo 2', cursive",
            textShadow: '4px 4px 0 #FFE066, 6px 6px 0 #00D9C4'
          }}
        >
          TOUCH ME!
        </h1>
        <p className="text-lg md:text-xl text-[#666] mt-2" style={{ fontFamily: "'Baloo 2', cursive" }}>
          tap the blob for silly sounds
        </p>
      </div>

      {/* Main interactive blob */}
      <div className="relative">
        {/* Shadow */}
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-0 w-40 h-8 md:w-56 md:h-10 bg-[#FF6B4A]/20 rounded-full blur-xl"
          style={{
            transform: `translateX(-50%) translateY(${10 + floatOffset * 0.5}px) scale(${isPressed ? 1.2 : 1})`,
            transition: 'transform 0.15s ease-out'
          }}
        />

        {/* The Blob */}
        <div
          ref={blobRef}
          onClick={handleInteraction}
          onTouchStart={handleInteraction}
          className="relative w-48 h-48 md:w-64 md:h-64 lg:w-72 lg:h-72 cursor-pointer select-none touch-none"
          style={{
            transform: `translateY(${floatOffset}px) scale(${isPressed ? 0.9 : 1}) skewX(${wobble.x}deg) skewY(${wobble.y}deg)`,
            transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Blob body */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at 30% 30%, #FF8A6B, #FF6B4A 50%, #E65A3A)',
              boxShadow: `
                inset -10px -10px 30px rgba(0,0,0,0.2),
                inset 15px 15px 30px rgba(255,255,255,0.3),
                0 20px 40px rgba(255,107,74,0.4)
              `,
            }}
          />

          {/* Shine */}
          <div
            className="absolute top-[15%] left-[20%] w-[30%] h-[20%] rounded-full bg-white/40 blur-sm"
            style={{ transform: 'rotate(-30deg)' }}
          />

          {/* Face */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-full h-full">
              {/* Eyes */}
              <div
                className="absolute top-[35%] left-[28%] w-4 h-6 md:w-5 md:h-7 bg-[#333] rounded-full"
                style={{ transform: isPressed ? 'scaleY(0.3)' : 'scaleY(1)', transition: 'transform 0.1s' }}
              />
              <div
                className="absolute top-[35%] right-[28%] w-4 h-6 md:w-5 md:h-7 bg-[#333] rounded-full"
                style={{ transform: isPressed ? 'scaleY(0.3)' : 'scaleY(1)', transition: 'transform 0.1s' }}
              />

              {/* Eye shine */}
              <div className="absolute top-[36%] left-[29%] w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full" />
              <div className="absolute top-[36%] right-[29%] w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full" />

              {/* Mouth */}
              <div
                className="absolute top-[55%] left-1/2 -translate-x-1/2"
                style={{
                  width: isPressed ? '40px' : '30px',
                  height: isPressed ? '30px' : '8px',
                  background: '#333',
                  borderRadius: isPressed ? '50%' : '20px',
                  transition: 'all 0.1s',
                }}
              />

              {/* Blush */}
              <div className="absolute top-[48%] left-[15%] w-6 h-4 md:w-8 md:h-5 bg-[#FFB4A2]/60 rounded-full blur-sm" />
              <div className="absolute top-[48%] right-[15%] w-6 h-4 md:w-8 md:h-5 bg-[#FFB4A2]/60 rounded-full blur-sm" />
            </div>
          </div>
        </div>

        {/* Particles */}
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute pointer-events-none text-2xl md:text-3xl"
            style={{
              left: '50%',
              top: '50%',
              animation: 'particle-fly 0.8s ease-out forwards',
              '--start-x': `${particle.x}px`,
              '--start-y': `${particle.y}px`,
              '--end-x': `${particle.x + Math.cos(particle.angle) * particle.velocity}px`,
              '--end-y': `${particle.y + Math.sin(particle.angle) * particle.velocity}px`,
            } as React.CSSProperties}
          >
            {particle.emoji}
          </div>
        ))}

        {/* Sound text popup */}
        {currentSound && (
          <div
            className="absolute left-1/2 -translate-x-1/2 -top-8 md:-top-12 pointer-events-none"
            style={{
              animation: 'pop-up 0.6s ease-out forwards',
              fontFamily: "'Baloo 2', cursive",
            }}
          >
            <span
              className="text-3xl md:text-5xl font-bold text-[#00D9C4]"
              style={{
                textShadow: '2px 2px 0 #FFE066, -2px -2px 0 #FF6B4A',
                WebkitTextStroke: '2px #333',
              }}
            >
              {currentSound}!
            </span>
          </div>
        )}
      </div>

      {/* Instructions */}
      <p
        className="mt-12 md:mt-16 text-[#999] text-sm md:text-base animate-pulse"
        style={{ fontFamily: "'Baloo 2', cursive" }}
      >
        (keep tapping for more sounds!)
      </p>

      {/* Footer */}
      <footer className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-xs text-[#AAA]" style={{ fontFamily: "'Baloo 2', cursive" }}>
          Requested by @Nishant293 · Built by @clonkbot
        </p>
      </footer>

      {/* Keyframe animations */}
      <style>{`
        @keyframes particle-fly {
          0% {
            transform: translate(var(--start-x), var(--start-y)) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--end-x), var(--end-y)) scale(0);
            opacity: 0;
          }
        }

        @keyframes pop-up {
          0% {
            transform: translateX(-50%) translateY(20px) scale(0.5);
            opacity: 0;
          }
          30% {
            transform: translateX(-50%) translateY(-30px) scale(1.2);
            opacity: 1;
          }
          100% {
            transform: translateX(-50%) translateY(-60px) scale(1);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
