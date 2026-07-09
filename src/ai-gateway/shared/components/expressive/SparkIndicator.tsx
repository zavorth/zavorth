import { useMemo } from "react";
"use client";


import { motion, AnimatePresence } from "framer-motion";

/*  Types                                                              */

type SparkState = "idle" | "thinking" | "streaming";

interface SparkIndicatorProps {
  state: SparkState;
  size?: number;
}

/*  Neon palette                                                       */

const NEON = {
  cyan: "#00E5FF",
  emerald: "#10B981",
  teal: "#14B8A6",
} as const;

/*  Four-pointed compass-rose star path                                */

/**
 * Builds an SVG path for an elongated 4-pointed star (compass rose).
 * `outerR` = tip radius, `innerR` = waist radius.
 * Centred on (cx, cy).
 */
function starPath(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2; // start from top
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ") + "Z";
}

/*  Ambient particles (tiny floating dots)                             */

interface ParticleSeed {
  id: number;
  angle: number;
  radius: number;
  size: number;
  duration: number;
  delay: number;
}

function useAmbientParticles(count: number): ParticleSeed[] {
  return useMemo(() => {
    const seeds: ParticleSeed[] = [];
    for (let i = 0; i < count; i++) {
      seeds.push({
        id: i,
        angle: (360 / count) * i + (i * 37) % 60,
        radius: 0.32 + (((i * 53) % 100) / 100) * 0.18,
        size: 1.2 + (((i * 29) % 100) / 100) * 1.4,
        duration: 4 + (((i * 41) % 100) / 100) * 5,
        delay: (((i * 67) % 100) / 100) * 3,
      });
    }
    return seeds;
  }, [count]);
}

/*  Orbital particle seeds (streaming state)                           */

interface OrbitalSeed {
  id: number;
  orbitRadius: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
}

function useOrbitalParticles(count: number): OrbitalSeed[] {
  return useMemo(() => {
    const colors = [NEON.cyan, NEON.emerald, NEON.teal];
    const seeds: OrbitalSeed[] = [];
    for (let i = 0; i < count; i++) {
      seeds.push({
        id: i,
        orbitRadius: 0.38 + (((i * 47) % 100) / 100) * 0.12,
        size: 2 + (((i * 31) % 100) / 100) * 2,
        duration: 1.8 + (((i * 59) % 100) / 100) * 1.2,
        delay: (i / count) * 1.5,
        color: colors[i % colors.length],
      });
    }
    return seeds;
  }, [count]);
}

/*  Concentric ripple ring (thinking state)                            */

function RippleRing({
  cx,
  cy,
  maxR,
  delay,
  color,
}: {
  cx: number;
  cy: number;
  maxR: number;
  delay: number;
  color: string;
}) {
  return (
    <motion.circle
      cx={cx}
      cy={cy}
      r={maxR * 0.25}
      fill="none"
      stroke={color}
      strokeWidth={1.2}
      initial={{ r: maxR * 0.18, opacity: 0.6 }}
      animate={{
        r: [maxR * 0.18, maxR * 0.7],
        opacity: [0.55, 0],
        strokeWidth: [1.2, 0.3],
      }}
      transition={{
        duration: 2.2,
        delay,
        repeat: Infinity,
        ease: "easeOut",
      }}
    />
  );
}

/*  Ambient floating dot                                                */

function AmbientDot({
  cx,
  cy,
  seed,
  viewSize,
  glowColor,
}: {
  cx: number;
  cy: number;
  seed: ParticleSeed;
  viewSize: number;
  glowColor: string;
}) {
  const r = seed.radius * (viewSize / 2);
  const rad0 = (seed.angle * Math.PI) / 180;
  const rad1 = rad0 + Math.PI * 0.6;
  const rad2 = rad0 + Math.PI * 1.3;

  const x0 = cx + r * Math.cos(rad0);
  const y0 = cy + r * Math.sin(rad0);
  const x1 = cx + r * Math.cos(rad1) * 1.1;
  const y1 = cy + r * Math.sin(rad1) * 1.1;
  const x2 = cx + r * Math.cos(rad2) * 0.9;
  const y2 = cy + r * Math.sin(rad2) * 0.9;

  return (
    <motion.circle
      r={seed.size}
      fill={glowColor}
      initial={{ cx: x0, cy: y0, opacity: 0 }}
      animate={{
        cx: [x0, x1, x2, x0],
        cy: [y0, y1, y2, y0],
        opacity: [0.15, 0.5, 0.25, 0.15],
      }}
      transition={{
        duration: seed.duration,
        delay: seed.delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

/*  Orbital dot (streaming state)                                       */

function OrbitalDot({
  cx,
  cy,
  seed,
  viewSize,
}: {
  cx: number;
  cy: number;
  seed: OrbitalSeed;
  viewSize: number;
}) {
  const orbitR = seed.orbitRadius * (viewSize / 2);
  // Generate keyframes for a full orbit
  const steps = 32;
  const cxFrames: number[] = [];
  const cyFrames: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    cxFrames.push(cx + orbitR * Math.cos(a));
    cyFrames.push(cy + orbitR * Math.sin(a));
  }

  return (
    <motion.circle
      r={seed.size}
      fill={seed.color}
      initial={{ cx: cxFrames[0], cy: cyFrames[0], opacity: 0 }}
      animate={{
        cx: cxFrames,
        cy: cyFrames,
        opacity: [0, 0.85, 0.85, 0.85, 0],
      }}
      transition={{
        duration: seed.duration,
        delay: seed.delay,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
}

/*  Main component                                                      */

export function SparkIndicator({ state, size = 96 }: SparkIndicatorProps) {
  const viewSize = 100; // internal SVG viewBox
  const cx = viewSize / 2;
  const cy = viewSize / 2;
  const outerR = viewSize * 0.42;
  const innerR = viewSize * 0.1;

  const gradientId = "spark-grad";
  const glowFilterId = "spark-glow";
  const path = starPath(cx, cy, outerR, innerR);

  const ambientParticles = useAmbientParticles(5);
  const orbitalParticles = useOrbitalParticles(4);

  const rotationTransition = {
    idle: { duration: 60, repeat: Infinity, ease: "linear" as const },
    thinking: { duration: 8, repeat: Infinity, ease: "linear" as const },
    streaming: { duration: 4, repeat: Infinity, ease: "linear" as const },
  }[state];

  const scaleAnimation = {
    idle: {
      scale: 1,
      transition: { duration: 2 },
    },
    thinking: {
      scale: [1, 1.08, 1],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
    streaming: {
      scale: [1, 0.97, 1.03, 1],
      transition: {
        duration: 0.8,
        repeat: Infinity,
        ease: "easeInOut" as const,
      },
    },
  }[state];

  const opacityAnimation = {
    idle: {
      opacity: [0.6, 1, 0.6],
      transition: { duration: 4, repeat: Infinity, ease: "easeInOut" as const },
    },
    thinking: {
      opacity: 1,
      transition: { duration: 0.4 },
    },
    streaming: {
      opacity: 1,
      transition: { duration: 0.3 },
    },
  }[state];

  const glowShadow = {
    idle: `drop-shadow(0 0 8px ${NEON.cyan}66)`,
    thinking: `drop-shadow(0 0 20px ${NEON.cyan}B3)`,
    streaming: `drop-shadow(0 0 24px ${NEON.emerald}CC) drop-shadow(0 0 48px ${NEON.emerald}55)`,
  }[state];

  const glowColor = {
    idle: NEON.cyan,
    thinking: NEON.cyan,
    streaming: NEON.emerald,
  }[state];

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={
        {
          width: size,
          height: size,
          "--neon-cyan": NEON.cyan,
          "--neon-emerald": NEON.emerald,
          "--neon-teal": NEON.teal,
        } as React.CSSProperties
      }
    >
      <motion.svg
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="block overflow-visible"
        animate={opacityAnimation}
      >
        <defs>
          {/* --- Animated gradient --- */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={NEON.cyan}>
              <animate
                attributeName="stop-color"
                values={`${NEON.cyan};${NEON.teal};${NEON.emerald};${NEON.cyan}`}
                dur={state === "thinking" ? "3s" : state === "streaming" ? "2s" : "10s"}
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="50%" stopColor={NEON.teal}>
              <animate
                attributeName="stop-color"
                values={`${NEON.teal};${NEON.emerald};${NEON.cyan};${NEON.teal}`}
                dur={state === "thinking" ? "3s" : state === "streaming" ? "2s" : "10s"}
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor={NEON.emerald}>
              <animate
                attributeName="stop-color"
                values={`${NEON.emerald};${NEON.cyan};${NEON.teal};${NEON.emerald}`}
                dur={state === "thinking" ? "3s" : state === "streaming" ? "2s" : "10s"}
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>

          {/* --- Glow filter --- */}
          <filter id={glowFilterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={state === "idle" ? 2.5 : state === "thinking" ? 4 : 5} />
            <feColorMatrix
              type="matrix"
              values={
                state === "streaming"
                  ? "0 0 0 0 0.063  0 0 0 0 0.725  0 0 0 0 0.506  0 0 0 0.7 0"
                  : "0 0 0 0 0  0 0 0 0 0.898  0 0 0 0 1  0 0 0 0.6 0"
              }
            />
          </filter>
        </defs>

        {/* ---------- Ambient particles ---------- */}
        {ambientParticles.map((seed) => (
          <AmbientDot
            key={seed.id}
            cx={cx}
            cy={cy}
            seed={seed}
            viewSize={viewSize}
            glowColor={glowColor}
          />
        ))}

        {/* ---------- Concentric ripple rings (thinking) ---------- */}
        <AnimatePresence>
          {state === "thinking" && (
            <>
              {[0, 0.7, 1.4].map((delay, i) => (
                <RippleRing
                  key={`ripple-${i}`}
                  cx={cx}
                  cy={cy}
                  maxR={outerR * 1.15}
                  delay={delay}
                  color={NEON.cyan}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        {/* ---------- Orbital particles (streaming) ---------- */}
        <AnimatePresence>
          {state === "streaming" &&
            orbitalParticles.map((seed) => (
              <OrbitalDot
                key={`orbital-${seed.id}`}
                cx={cx}
                cy={cy}
                seed={seed}
                viewSize={viewSize}
              />
            ))}
        </AnimatePresence>

        {/* ---------- Glow layer (blurred duplicate) ---------- */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={rotationTransition}
          style={{ originX: "50%", originY: "50%", transformBox: "fill-box" }}
        >
          <motion.path
            d={path}
            fill={`url(#${gradientId})`}
            filter={`url(#${glowFilterId})`}
            animate={scaleAnimation}
            style={{ originX: "50%", originY: "50%", transformBox: "fill-box" }}
          />
        </motion.g>

        {/* ---------- Primary star ---------- */}
        <motion.g
          animate={{ rotate: 360 }}
          transition={rotationTransition}
          style={{ originX: "50%", originY: "50%", transformBox: "fill-box" }}
        >
          <motion.path
            d={path}
            fill={`url(#${gradientId})`}
            animate={scaleAnimation}
            style={{
              originX: "50%",
              originY: "50%",
              transformBox: "fill-box",
              filter: glowShadow,
            }}
          />
        </motion.g>

        {/* ---------- Inner bright core ---------- */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={innerR * 0.55}
          fill="white"
          animate={{
            opacity: state === "idle" ? [0.35, 0.6, 0.35] : state === "thinking" ? [0.5, 0.9, 0.5] : [0.7, 1, 0.7],
            r: state === "streaming" ? [innerR * 0.45, innerR * 0.6, innerR * 0.45] : innerR * 0.55,
          }}
          transition={{
            duration: state === "idle" ? 4 : state === "thinking" ? 1.5 : 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{
            filter: `drop-shadow(0 0 6px ${glowColor})`,
          }}
        />
      </motion.svg>
    </div>
  );
}
