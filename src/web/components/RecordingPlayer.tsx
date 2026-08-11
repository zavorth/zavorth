/**
 * RecordingPlayer — Asciinema .cast file player for the Zavorth ZavorthControl.
 *
 * Loads a recording from the API and plays it back frame-by-frame,
 * respecting original timestamps. Features:
 *  - Play/Pause/Stop controls
 *  - Playback speed selector (0.5x, 1x, 2x, 4x)
 *  - Progress bar with seek support
 *  - Frame counter and elapsed time display
 *  - Same dark terminal aesthetic as LiveTerminal
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

type AsciinemaFrame = [number, 'o' | 'i', string];

type AsciinemaHeader = {
  version: number;
  width: number;
  height: number;
  timestamp: number;
  title: string;
};

type Recording = {
  header: AsciinemaHeader;
  frames: AsciinemaFrame[];
};

type PlayerState = 'stopped' | 'playing' | 'paused';

export function RecordingPlayer({
  recordingUrl,
  recordingData,
}: {
  recordingUrl?: string;
  recordingData?: Recording;
}) {
  const [recording, setRecording] = useState<Recording | null>(recordingData || null);
  const [state, setState] = useState<PlayerState>('stopped');
  const [currentFrame, setCurrentFrame] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recording from URL
  useEffect(() => {
    if (recordingData) {
      setRecording(recordingData);
      return;
    }
    if (!recordingUrl) return;

    setLoading(true);
    fetch(recordingUrl)
      .then((res) => res.text())
      .then((raw) => {
        const lines = raw.trim().split('\n');
        if (lines.length === 0) throw new Error('Empty recording');
        const header = JSON.parse(lines[0]) as AsciinemaHeader;
        const frames = lines.slice(1).map((line) => JSON.parse(line) as AsciinemaFrame);
        setRecording({ header, frames });
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [recordingUrl, recordingData]);

  const totalFrames = recording?.frames.length || 0;
  const totalDuration = recording?.frames[totalFrames - 1]?.[0] || 0;
  const currentTime = recording?.frames[currentFrame]?.[0] || 0;

  const playNextFrame = useCallback(() => {
    if (!recording || currentFrame >= totalFrames - 1) {
      setState('stopped');
      return;
    }

    const frame = recording.frames[currentFrame];
    if (frame[1] === 'o') {
      setOutput((prev) => prev + frame[2]);
    }

    const nextFrame = currentFrame + 1;
    setCurrentFrame(nextFrame);

    if (nextFrame < totalFrames) {
      const currentTimestamp = frame[0];
      const nextTimestamp = recording.frames[nextFrame][0];
      const delay = Math.max(10, ((nextTimestamp - currentTimestamp) * 1000) / speed);

      timerRef.current = setTimeout(playNextFrame, delay);
    } else {
      setState('stopped');
    }
  }, [recording, currentFrame, totalFrames, speed]);

  const play = useCallback(() => {
    if (!recording) return;
    if (currentFrame >= totalFrames - 1) {
      // Restart from beginning
      setCurrentFrame(0);
      setOutput('');
    }
    setState('playing');
  }, [recording, currentFrame, totalFrames]);

  const pause = () => {
    setState('paused');
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const stop = () => {
    setState('stopped');
    setCurrentFrame(0);
    setOutput('');
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => {
    if (state === 'playing') {
      playNextFrame();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state, playNextFrame]);

  // Auto-scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [output]);

  const seekTo = (frameIndex: number) => {
    if (!recording) return;
    pause();
    // Rebuild output up to the target frame
    let rebuilt = '';
    for (let i = 0; i <= frameIndex && i < totalFrames; i++) {
      if (recording.frames[i][1] === 'o') {
        rebuilt += recording.frames[i][2];
      }
    }
    setOutput(rebuilt);
    setCurrentFrame(frameIndex);
  };

  const progressPercent = totalFrames > 0 ? (currentFrame / totalFrames) * 100 : 0;

  if (loading) {
    return <div style={styles.container}><div style={styles.loading}>Loading recording...</div></div>;
  }

  if (error) {
    return <div style={styles.container}><div style={styles.error}>Error: {error}</div></div>;
  }

  if (!recording) {
    return <div style={styles.container}><div style={styles.loading}>No recording selected</div></div>;
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>
          Recording: {recording.header.title || 'Recording'}
        </span>
        <span style={styles.meta}>
          {totalFrames} frames · {totalDuration.toFixed(1)}s
        </span>
      </div>

      {/* Terminal Output */}
      <div ref={containerRef} style={styles.output}>
        <pre style={styles.pre}>{output || '\n  Press play to start the replay...\n'}</pre>
      </div>

      {/* Progress Bar */}
      <div style={styles.progressContainer}>
        <div
          style={styles.progressBar}
          onClick={(e) => {
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            seekTo(Math.floor(pct * totalFrames));
          }}
        >
          <div style={{ ...styles.progressFill, width: `${progressPercent}%` }} />
        </div>
        <span style={styles.timeLabel}>
          {currentTime.toFixed(1)}s / {totalDuration.toFixed(1)}s
        </span>
      </div>

      {/* Controls */}
      <div style={styles.controls}>
        <div style={styles.controlGroup}>
          {state === 'playing' ? (
            <button style={styles.btn} onClick={pause}>⏸ Pause</button>
          ) : (
            <button style={styles.btnPrimary} onClick={play}>▶ Play</button>
          )}
          <button style={styles.btn} onClick={stop}>⏹ Stop</button>
        </div>
        <div style={styles.controlGroup}>
          {[0.5, 1, 2, 4].map((s) => (
            <button
              key={s}
              style={speed === s ? styles.speedActive : styles.speedBtn}
              onClick={() => setSpeed(s)}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, any> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '400px',
    background: '#0f172a',
    borderRadius: '12px',
    border: '1px solid #1e293b',
    overflow: 'hidden',
    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    background: '#1e293b',
    borderBottom: '1px solid #334155',
  },
  title: {
    color: '#e2e8f0',
    fontSize: '14px',
    fontWeight: 600,
  },
  meta: {
    color: '#64748b',
    fontSize: '12px',
  },
  output: {
    flex: 1,
    padding: '12px 16px',
    overflowY: 'auto',
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#e2e8f0',
  },
  pre: {
    margin: 0,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    fontFamily: 'inherit',
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 16px',
    background: '#1e293b',
  },
  progressBar: {
    flex: 1,
    height: '6px',
    background: '#334155',
    borderRadius: '3px',
    cursor: 'pointer',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
    borderRadius: '3px',
    transition: 'width 0.1s',
  },
  timeLabel: {
    color: '#64748b',
    fontSize: '11px',
    minWidth: '80px',
    textAlign: 'right',
  },
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 16px',
    background: '#1e293b',
    borderTop: '1px solid #334155',
  },
  controlGroup: {
    display: 'flex',
    gap: '6px',
  },
  btn: {
    padding: '5px 12px',
    background: '#334155',
    color: '#e2e8f0',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnPrimary: {
    padding: '5px 12px',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  speedBtn: {
    padding: '3px 8px',
    background: '#334155',
    color: '#94a3b8',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  speedActive: {
    padding: '3px 8px',
    background: '#8b5cf6',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#64748b',
    fontSize: '14px',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#f87171',
    fontSize: '14px',
  },
};

export default RecordingPlayer;
