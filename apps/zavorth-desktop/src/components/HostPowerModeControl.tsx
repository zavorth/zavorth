import { useEffect, useState } from 'react';
import * as apiClient from '../apiClient';
import { createLogger } from '../logger';
import { asErrorLike } from '../lib/errors';

const logger = createLogger('trust');

interface HostPowerModeControlProps {
  workspaceId: string;
}

export function HostPowerModeControl({ workspaceId }: HostPowerModeControlProps) {
  const [enabled, setEnabled] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [duration, setDuration] = useState(15);
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    let active = true;

    const checkStatus = async () => {
      try {
        const res = await apiClient.getHostPowerStatus(workspaceId);
        if (active) {
          setEnabled(res.enabled);
          setTimeLeft(res.timeLeftSeconds || 0);
        }
      } catch (error: unknown) {
        const err = asErrorLike(error);

        logger.error('Failed to get host power status', err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [workspaceId]);

  // Local tick countdown
  useEffect(() => {
    if (!enabled || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev ? 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [enabled, timeLeft]);

  const handleToggle = async () => {
    if (enabled) {
      try {
        await apiClient.disableHostPower(workspaceId);
        setEnabled(false);
        setTimeLeft(0);
      } catch (error: unknown) {
        alert('Failed to disable Host Power Mode');
      }
    } else {
      setShowOptions(true);
    }
  };

  const handleEnable = async () => {
    try {
      await apiClient.enableHostPower(workspaceId, duration);
      setEnabled(true);
      setTimeLeft(duration * 60);
      setShowOptions(false);
    } catch (error: unknown) {
      alert('Failed to enable Host Power Mode');
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="zvd-sidebar-widget" style={{ marginTop: '8px', padding: '10px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px', textTransform: 'uppercase', color: enabled ? '#f44336' : '#888' }}>
            Host Power Mode
          </span>
          {enabled && timeLeft > 0 ? (
            <span style={{ fontSize: '11px', color: '#ff9800' }}>Active: {timeFormatted}</span>
          ) : (
            <span style={{ fontSize: '11px', color: '#666' }}>Disabled</span>
          )}
        </div>
        <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '34px', height: '20px' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={handleToggle}
            style={{ opacity: 0, width: 0, height: 0 }}
          />
          <span className="slider round" style={{
            position: 'absolute',
            cursor: 'pointer',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: enabled ? '#f44336' : '#ccc',
            transition: '.4s',
            borderRadius: '20px'
          }}>
            <span style={{
              position: 'absolute',
              content: '""',
              height: '14px', width: '14px',
              left: enabled ? '16px' : '4px',
              bottom: '3px',
              backgroundColor: 'white',
              transition: '.4s',
              borderRadius: '50%'
            }} />
          </span>
        </label>
      </div>

      {showOptions && (
        <div style={{ marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px' }}>Select Duration (Max 30 min):</div>
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ width: '100%', padding: '4px', background: '#333', border: '1px solid #555', color: '#fff', borderRadius: '3px', fontSize: '12px' }}
          >
            <option value={5}>5 Minutes</option>
            <option value={10}>10 Minutes</option>
            <option value={15}>15 Minutes</option>
            <option value={30}>30 Minutes</option>
          </select>
          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowOptions(false)}
              style={{ padding: '3px 8px', fontSize: '11px', border: 'none', background: '#555', color: '#fff', borderRadius: '3px', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={handleEnable}
              style={{ padding: '3px 8px', fontSize: '11px', border: 'none', background: '#f44336', color: '#fff', borderRadius: '3px', cursor: 'pointer' }}
            >
              Enable
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
