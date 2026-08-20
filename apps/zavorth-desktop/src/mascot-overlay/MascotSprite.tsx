import React from 'react';

interface MascotSpriteProps {
  state: 'idle' | 'thinking' | 'working' | 'finished';
}

export function MascotSprite({ state }: MascotSpriteProps) {
  return (
    <div className={`mascot-sprite-container mascot-state-${state}`}>
      <svg
        width="110"
        height="110"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mascot-svg"
      >
        {/* Glow backdrop for thinking/working states */}
        <circle cx="60" cy="65" r="45" fill="url(#mascotGlow)" className="mascot-glow-ring" />

        {/* Outer Ears */}
        {/* Left Ear */}
        <path
          d="M30 55 L15 15 L50 40 Z"
          fill="#E05B17"
          stroke="#1F1F1F"
          strokeWidth="3.5"
          strokeLinejoin="round"
          className="mascot-ear mascot-ear-left"
        />
        {/* Right Ear */}
        <path
          d="M90 55 L105 15 L70 40 Z"
          fill="#E05B17"
          stroke="#1F1F1F"
          strokeWidth="3.5"
          strokeLinejoin="round"
          className="mascot-ear mascot-ear-right"
        />

        {/* Inner Ears */}
        <path d="M32 50 L22 23 L44 38 Z" fill="#F7A072" className="mascot-ear mascot-ear-left-inner" />
        <path d="M88 50 L98 23 L76 38 Z" fill="#F7A072" className="mascot-ear mascot-ear-right-inner" />

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
          className="mascot-face"
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
          className="mascot-eye mascot-eye-left"
        />
        {/* Right Eye */}
        <ellipse
          cx="77"
          cy="58"
          rx="5"
          ry="6"
          fill="#1F1F1F"
          className="mascot-eye mascot-eye-right"
        />

        {/* Eye Highlights */}
        <circle cx="45" cy="56" r="1.8" fill="#FFFFFF" className="mascot-eye-pupil" />
        <circle cx="79" cy="56" r="1.8" fill="#FFFFFF" className="mascot-eye-pupil" />

        {/* Nose */}
        <polygon
          points="56,86 64,86 60,91"
          fill="#1F1F1F"
          stroke="#1F1F1F"
          strokeWidth="1.5"
          strokeLinejoin="round"
          className="mascot-nose"
        />

        {/* Cute blushing cheeks */}
        <circle cx="34" cy="68" r="4.5" fill="#FFA5A5" opacity="0.6" className="mascot-blush" />
        <circle cx="86" cy="68" r="4.5" fill="#FFA5A5" opacity="0.6" className="mascot-blush" />

        <defs>
          <radialGradient id="mascotGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#F16A21" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#F16A21" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      <style>{`
        .mascot-sprite-container {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 120px;
          height: 120px;
          position: relative;
        }

        .mascot-svg {
          filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.25));
          transition: transform 0.3s ease;
        }

        /* Idle State Animations */
        .mascot-eye {
          transform-origin: 50% 58%;
          animation: mascot-blink 4.5s infinite;
        }

        .mascot-ear-left {
          transform-origin: 30px 55px;
          animation: mascot-ear-twitch-left 6s infinite ease-in-out;
        }

        .mascot-ear-right {
          transform-origin: 90px 55px;
          animation: mascot-ear-twitch-right 6s infinite ease-in-out;
        }

        /* Thinking State Animations */
        .mascot-state-thinking .mascot-svg {
          animation: mascot-tilt 2.5s infinite ease-in-out;
        }

        .mascot-state-thinking .mascot-glow-ring {
          animation: mascot-glow-pulse 1.5s infinite ease-in-out;
        }

        /* Working State Animations */
        .mascot-state-working .mascot-svg {
          animation: mascot-working-bob 0.8s infinite ease-in-out;
        }

        /* Finished State Animations */
        .mascot-state-finished .mascot-svg {
          transform: scale(1.05);
        }
        .mascot-state-finished .mascot-eye {
          animation: none;
          transform: scaleY(0.2);
        }

        @keyframes mascot-blink {
          0%, 90%, 100% {
            transform: scaleY(1);
          }
          95% {
            transform: scaleY(0.1);
          }
        }

        @keyframes mascot-ear-twitch-left {
          0%, 90%, 100% { transform: rotate(0deg); }
          93% { transform: rotate(-5deg); }
          96% { transform: rotate(3deg); }
        }

        @keyframes mascot-ear-twitch-right {
          0%, 88%, 100% { transform: rotate(0deg); }
          91% { transform: rotate(5deg); }
          94% { transform: rotate(-3deg); }
        }

        @keyframes mascot-tilt {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(6deg) translateY(-2px); }
        }

        @keyframes mascot-glow-pulse {
          0%, 100% { opacity: 0.2; transform: scale(0.9); transform-origin: 60px 65px; }
          50% { opacity: 0.9; transform: scale(1.15); transform-origin: 60px 65px; }
        }

        @keyframes mascot-working-bob {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-4px) rotate(-2deg); }
          66% { transform: translateY(1px) rotate(2deg); }
        }
      `}</style>
    </div>
  );
}
