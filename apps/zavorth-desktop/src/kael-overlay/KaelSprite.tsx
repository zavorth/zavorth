import React from 'react';

interface KaelSpriteProps {
  state: 'idle' | 'thinking' | 'working' | 'finished';
}

export function KaelSprite({ state }: KaelSpriteProps) {
  // We use pure SVG with CSS animations for Kael (a small, precise fox).
  return (
    <div className={`kael-sprite-container kael-state-${state}`}>
      <svg
        width="110"
        height="110"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="kael-svg"
      >
        {/* Glow backdrop for thinking/working states */}
        <circle cx="60" cy="65" r="45" fill="url(#kaelGlow)" className="kael-glow-ring" />

        {/* Outer Ears */}
        {/* Left Ear */}
        <path
          d="M30 55 L15 15 L50 40 Z"
          fill="#E05B17"
          stroke="#1F1F1F"
          strokeWidth="3.5"
          strokeLinejoin="round"
          className="kael-ear kael-ear-left"
        />
        {/* Right Ear */}
        <path
          d="M90 55 L105 15 L70 40 Z"
          fill="#E05B17"
          stroke="#1F1F1F"
          strokeWidth="3.5"
          strokeLinejoin="round"
          className="kael-ear kael-ear-right"
        />

        {/* Inner Ears */}
        <path d="M32 50 L22 23 L44 38 Z" fill="#F7A072" className="kael-ear kael-ear-left-inner" />
        <path d="M88 50 L98 23 L76 38 Z" fill="#F7A072" className="kael-ear kael-ear-right-inner" />

        {/* Cheeks / White Fur Base */}
        <path
          d="M20 70 C20 95, 100 95, 100 70 C100 70, 90 85, 60 85 C30 85, 20 70, 20 70 Z"
          fill="#F5F5F0"
          stroke="#1F1F1F"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Main Orange Face/Head */}
        <path
          d="M25 60 C25 40, 95 40, 95 60 C95 72, 80 82, 60 92 C40 82, 25 72, 25 60 Z"
          fill="#F16A21"
          stroke="#1F1F1F"
          strokeWidth="3.5"
          strokeLinejoin="round"
          className="kael-face"
        />

        {/* White Face Markings (Snout Area) */}
        <path
          d="M40 70 L60 92 L80 70 C70 76, 50 76, 40 70 Z"
          fill="#F5F5F0"
          stroke="#1F1F1F"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {/* Eyes */}
        {/* Left Eye */}
        <ellipse
          cx="43"
          cy="58"
          rx="5"
          ry="6"
          fill="#1F1F1F"
          className="kael-eye kael-eye-left"
        />
        {/* Right Eye */}
        <ellipse
          cx="77"
          cy="58"
          rx="5"
          ry="6"
          fill="#1F1F1F"
          className="kael-eye kael-eye-right"
        />

        {/* Eye Highlights */}
        <circle cx="45" cy="56" r="1.8" fill="#FFFFFF" className="kael-eye-pupil" />
        <circle cx="79" cy="56" r="1.8" fill="#FFFFFF" className="kael-eye-pupil" />

        {/* Nose */}
        <polygon
          points="56,86 64,86 60,91"
          fill="#1F1F1F"
          stroke="#1F1F1F"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="kael-nose"
        />

        {/* Cute blushing cheeks */}
        <circle cx="34" cy="68" r="4.5" fill="#FFA5A5" opacity="0.6" className="kael-blush" />
        <circle cx="86" cy="68" r="4.5" fill="#FFA5A5" opacity="0.6" className="kael-blush" />

        <defs>
          <radialGradient id="kaelGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F16A21" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F16A21" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      <style>{`
        .kael-sprite-container {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 120px;
          height: 120px;
          position: relative;
        }

        .kael-svg {
          filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.25));
          transition: transform 0.3s ease;
        }

        /* Idle State Animations */
        .kael-eye {
          transform-origin: 50% 58%;
          animation: kael-blink 4.5s infinite;
        }

        .kael-ear-left {
          transform-origin: 30px 55px;
          animation: kael-ear-twitch-left 6s infinite ease-in-out;
        }

        .kael-ear-right {
          transform-origin: 90px 55px;
          animation: kael-ear-twitch-right 6s infinite ease-in-out;
        }

        /* Thinking State Animations */
        .kael-state-thinking .kael-svg {
          animation: kael-tilt 2.5s infinite ease-in-out;
        }

        .kael-state-thinking .kael-glow-ring {
          animation: kael-glow-pulse 1.5s infinite ease-in-out;
        }

        /* Working State Animations */
        .kael-state-working .kael-svg {
          animation: kael-working-bob 0.8s infinite ease-in-out;
        }

        /* Finished State Animations */
        .kael-state-finished .kael-svg {
          transform: scale(1.05);
        }
        .kael-state-finished .kael-eye {
          animation: none;
          transform: scaleY(0.2);
        }

        @keyframes kael-blink {
          0%, 90%, 100% {
            transform: scaleY(1);
          }
          95% {
            transform: scaleY(0.1);
          }
        }

        @keyframes kael-ear-twitch-left {
          0%, 90%, 100% { transform: rotate(0deg); }
          93% { transform: rotate(-5deg); }
          96% { transform: rotate(3deg); }
        }

        @keyframes kael-ear-twitch-right {
          0%, 88%, 100% { transform: rotate(0deg); }
          91% { transform: rotate(5deg); }
          94% { transform: rotate(-3deg); }
        }

        @keyframes kael-tilt {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(6deg) translateY(-2px); }
        }

        @keyframes kael-glow-pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.9); transform-origin: 60px 65px; }
          50% { opacity: 0.9; transform: scale(1.15); transform-origin: 60px 65px; }
        }

        @keyframes kael-working-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-4px) rotate(-2deg); }
          66% { transform: translateY(1px) rotate(2deg); }
        }
      `}</style>
    </div>
  );
}
