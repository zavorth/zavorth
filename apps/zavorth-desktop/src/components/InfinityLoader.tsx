import React from 'react';

export function InfinityLoader(props: {
  text?: string;
  size?: number;
  centered?: boolean;
}) {
  const size = props.size || 80;
  const centered = props.centered !== false;

  const content = (
    <div className="zvd-infinity-loader-container">
      <style>{`
        .zvd-infinity-loader-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: #a1a1aa;
        }

        .zvd-infinity-svg {
          filter: drop-shadow(0 0 8px rgba(241, 106, 33, 0.4));
        }

        .zvd-infinity-bg {
          stroke: rgba(255, 255, 255, 0.04);
          stroke-width: 4;
          fill: none;
        }

        .zvd-infinity-path {
          stroke: url(#infinityGradient);
          stroke-width: 4;
          stroke-linecap: round;
          fill: none;
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          animation: zvdTrace 2s cubic-bezier(0.445, 0.05, 0.55, 0.95) infinite;
        }

        .zvd-infinity-glow {
          fill: var(--zvd-accent, #f16a21);
          opacity: 0.15;
          filter: blur(6px);
          animation: zvdPulse 2s ease-in-out infinite;
        }

        .zvd-infinity-text {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          animation: zvdTextPulse 1.5s ease-in-out infinite;
        }

        @keyframes zvdTrace {
          0% {
            stroke-dashoffset: 200;
          }
          50% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -200;
          }
        }

        @keyframes zvdPulse {
          0%, 100% {
            transform: scale(0.9) translate(-5px, -5px);
            opacity: 0.1;
          }
          50% {
            transform: scale(1.1) translate(-5px, -5px);
            opacity: 0.25;
          }
        }

        @keyframes zvdTextPulse {
          0%, 100% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.9;
          }
        }
      `}</style>

      <svg
        width={size}
        height={size * 0.6}
        viewBox="0 0 100 60"
        xmlns="http://www.w3.org/2000/svg"
        className="zvd-infinity-svg"
      >
        <defs>
          <linearGradient id="infinityGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--zvd-accent, #f16a21)" />
            <stop offset="50%" stopColor="#ff9f43" />
            <stop offset="100%" stopColor="var(--zvd-accent, #f16a21)" />
          </linearGradient>
        </defs>

        <circle cx="50" cy="30" r="10" className="zvd-infinity-glow" style={{ transformOrigin: '50px 30px' }} />

        <path
          d="M 50 30 C 65 15, 85 15, 85 30 C 85 45, 65 45, 50 30 C 35 15, 15 15, 15 30 C 15 45, 35 45, 50 30 Z"
          className="zvd-infinity-bg"
        />

        <path
          d="M 50 30 C 65 15, 85 15, 85 30 C 85 45, 65 45, 50 30 C 35 15, 15 15, 15 30 C 15 45, 35 45, 50 30 Z"
          className="zvd-infinity-path"
        />
      </svg>

      {props.text && (
        <span className="zvd-infinity-text">
          {props.text}
        </span>
      )}
    </div>
  );

  if (centered) {
    return (
      <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', padding: '24px', boxSizing: 'border-box' }}>
        {content}
      </div>
    );
  }

  return content;
}
