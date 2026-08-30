import React from 'react';

export interface MascotSpriteProps {
  state: 'idle' | 'thinking' | 'working' | 'finished';
}

function mascotFrame(frame: number): React.ReactNode {
  const bob = frame === 1 || frame === 4 ? -8 : 0;
  const armRightY = 256 + bob + (frame === 1 ? -16 : frame === 5 ? 8 : 0);
  const armLeftY = 256 + bob + (frame === 4 ? -16 : frame === 2 ? 8 : 0);
  const footLeftY = 416 + (frame === 1 ? -16 : 0);
  const footRightY = 416 + (frame === 4 ? -16 : 0);
  const antennaY = 64 + bob;
  const bridgeY = 192 + bob;
  const bodyY = 192 + bob;
  const torsoY = 320 + bob;
  const eyeY = 240 + bob;
  const eyeHeight = frame === 3 ? 16 : 64;

  return (
    <>
      <rect x={128} y={antennaY} width={64} height={128} fill="url(#zvMascotGreen)" />
      <rect x={320} y={antennaY} width={64} height={128} fill="url(#zvMascotGreen)" />
      <rect x={192} y={bridgeY} width={128} height={64} fill="url(#zvMascotGreen)" />
      <rect x={64} y={bodyY} width={384} height={128} fill="url(#zvMascotGreen)" />
      <rect x={0} y={armLeftY} width={64} height={64} fill="url(#zvMascotGreen)" />
      <rect x={448} y={armRightY} width={64} height={64} fill="url(#zvMascotGreen)" />
      <rect x={64} y={torsoY} width={384} height={96} fill="url(#zvMascotGreen)" />
      <rect x={128} y={footLeftY} width={96} height={64} fill="url(#zvMascotGreen)" />
      <rect x={288} y={footRightY} width={96} height={64} fill="url(#zvMascotGreen)" />
      <rect x={160} y={eyeY} width={32} height={eyeHeight} fill="#000000" />
      <rect x={320} y={eyeY} width={32} height={eyeHeight} fill="#000000" />
    </>
  );
}

export function MascotSprite({ state }: MascotSpriteProps) {
  return (
    <div className={`mascot-sprite-container mascot-state-${state}`}>
      <svg
        viewBox="0 0 512 512"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
        className="mascot-svg"
        role="img"
        aria-label="Zavorth Mascot"
      >
        <defs>
          <linearGradient id="zvMascotGreen" x1="64" y1="64" x2="448" y2="512" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2A5E2F" />
            <stop offset="100%" stopColor="#3F7A42" />
          </linearGradient>
          <radialGradient id="mascotGlowPulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00e88f" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#00e88f" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Aura glow backdrop active during thinking and working */}
        <circle cx={256} cy={270} r={220} fill="url(#mascotGlowPulse)" className="mascot-glow-ring" />

        {/* 6 Animation Frames */}
        <g className="zvd-mascot-frame zvd-mascot-frame-0">{mascotFrame(0)}</g>
        <g className="zvd-mascot-frame zvd-mascot-frame-1">{mascotFrame(1)}</g>
        <g className="zvd-mascot-frame zvd-mascot-frame-2">{mascotFrame(2)}</g>
        <g className="zvd-mascot-frame zvd-mascot-frame-3">{mascotFrame(3)}</g>
        <g className="zvd-mascot-frame zvd-mascot-frame-4">{mascotFrame(4)}</g>
        <g className="zvd-mascot-frame zvd-mascot-frame-5">{mascotFrame(5)}</g>
      </svg>

      <style>{`
        .mascot-sprite-container {
          display: flex;
          justify-content: center;
          align-items: center;
          width: 120px;
          height: 120px;
          position: relative;
          user-select: none;
        }

        .mascot-svg {
          width: 110px;
          height: 110px;
          filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4));
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .mascot-glow-ring {
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        /* Base frame visibility */
        .zvd-mascot-frame {
          visibility: hidden;
        }
        .zvd-mascot-frame-0 {
          visibility: visible;
        }

        /* --- Idle State: Calm breathing with occasional blink --- */
        .mascot-state-idle .mascot-svg {
          animation: zvd-mascot-idle-breathe 4s ease-in-out infinite;
        }
        .mascot-state-idle .zvd-mascot-frame-0 {
          animation: zvd-mascot-idle-blink 4.8s steps(1, end) infinite;
        }
        .mascot-state-idle .zvd-mascot-frame-3 {
          animation: zvd-mascot-idle-blink-open 4.8s steps(1, end) infinite;
        }

        /* --- Thinking State: Gentle tilt & rhythmic brain pulse --- */
        .mascot-state-thinking .mascot-svg {
          animation: zvd-mascot-thinking-tilt 2.4s ease-in-out infinite;
        }
        .mascot-state-thinking .mascot-glow-ring {
          opacity: 1;
          animation: zvd-mascot-glow-pulse 1.6s ease-in-out infinite;
        }

        /* --- Working State: Full 6-frame walking & arm motion --- */
        .mascot-state-working .mascot-glow-ring {
          opacity: 0.7;
        }
        .mascot-state-working .mascot-svg {
          animation: zvd-mascot-working-bounce 0.8s ease-in-out infinite;
        }
        .mascot-state-working .zvd-mascot-frame-0 {
          animation: zvd-frame-0 1.2s steps(1, end) infinite;
        }
        .mascot-state-working .zvd-mascot-frame-1 {
          animation: zvd-frame-1 1.2s steps(1, end) infinite;
        }
        .mascot-state-working .zvd-mascot-frame-2 {
          animation: zvd-frame-2 1.2s steps(1, end) infinite;
        }
        .mascot-state-working .zvd-mascot-frame-3 {
          animation: zvd-frame-3 1.2s steps(1, end) infinite;
        }
        .mascot-state-working .zvd-mascot-frame-4 {
          animation: zvd-frame-4 1.2s steps(1, end) infinite;
        }
        .mascot-state-working .zvd-mascot-frame-5 {
          animation: zvd-frame-5 1.2s steps(1, end) infinite;
        }

        /* --- Finished State: Joyful celebration jump --- */
        .mascot-state-finished .mascot-svg {
          animation: zvd-mascot-finished-jump 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .mascot-state-finished .mascot-glow-ring {
          opacity: 0.9;
          fill: url(#zvMascotGreen);
        }

        /* Keyframes */
        @keyframes zvd-mascot-idle-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }

        @keyframes zvd-mascot-idle-blink {
          0%, 88%, 100% { visibility: visible; }
          88.01%, 95% { visibility: hidden; }
        }
        @keyframes zvd-mascot-idle-blink-open {
          0%, 88%, 100% { visibility: hidden; }
          88.01%, 95% { visibility: visible; }
        }

        @keyframes zvd-mascot-thinking-tilt {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          50% { transform: rotate(5deg) translateY(-3px); }
        }

        @keyframes zvd-mascot-glow-pulse {
          0%, 100% { transform: scale(0.85); opacity: 0.25; }
          50% { transform: scale(1.1); opacity: 0.85; }
        }

        @keyframes zvd-mascot-working-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes zvd-mascot-finished-jump {
          0% { transform: scale(1) translateY(0); }
          50% { transform: scale(1.12) translateY(-10px); }
          100% { transform: scale(1.05) translateY(-3px); }
        }

        @keyframes zvd-frame-0 {
          0%, 16.66% { visibility: visible; }
          16.67%, 100% { visibility: hidden; }
        }
        @keyframes zvd-frame-1 {
          0%, 16.66% { visibility: hidden; }
          16.67%, 33.33% { visibility: visible; }
          33.34%, 100% { visibility: hidden; }
        }
        @keyframes zvd-frame-2 {
          0%, 33.33% { visibility: hidden; }
          33.34%, 50% { visibility: visible; }
          50.01%, 100% { visibility: hidden; }
        }
        @keyframes zvd-frame-3 {
          0%, 50% { visibility: hidden; }
          50.01%, 66.66% { visibility: visible; }
          66.67%, 100% { visibility: hidden; }
        }
        @keyframes zvd-frame-4 {
          0%, 66.66% { visibility: hidden; }
          66.67%, 83.33% { visibility: visible; }
          83.34%, 100% { visibility: hidden; }
        }
        @keyframes zvd-frame-5 {
          0%, 83.33% { visibility: hidden; }
          83.34%, 100% { visibility: visible; }
        }
      `}</style>
    </div>
  );
}
