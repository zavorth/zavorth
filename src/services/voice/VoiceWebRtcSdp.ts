/**
 * Minimal SDP answer builder for Desktop WebRTC offer (audio-only signaling path).
 * Enables real RTCPeerConnection setRemoteDescription without native node-webrtc media.
 * Media STT still uses MediaRecorder/HTTP chunks; WebRTC proves ICE/SDP connectivity.
 */

/**
 * Build a crude but often-accepted answer SDP by mirroring the offer's media lines
 * with a=recvonly (server receives client audio conceptually) / setup:passive.
 */
export function buildWebRtcAnswerFromOffer(offerSdp: string): string {
  const offer = String(offerSdp || '').replace(/\r\n/g, '\n').trim();
  if (!offer) {
    throw new Error('Empty SDP offer.');
  }

  const lines = offer.split('\n').map((l) => l.trimEnd());
  const out: string[] = [];
  let inMedia = false;
  let mediaKind: string | null = null;

  for (const line of lines) {
    if (line.startsWith('v=')) {
      out.push(line);
      continue;
    }
    if (line.startsWith('o=')) {
      // Session origin — mark as answerer
      out.push(line.replace(/^o=(\S+)/, 'o=zavorth'));
      continue;
    }
    if (line.startsWith('s=')) {
      out.push('s=ZavorthVoiceAnswer');
      continue;
    }
    if (line.startsWith('t=')) {
      out.push(line);
      continue;
    }
    if (line.startsWith('m=')) {
      inMedia = true;
      mediaKind = line.split(' ')[0]?.slice(2) || null;
      // Keep audio m-line; mark others as 0 port (reject)
      if (mediaKind === 'audio') {
        out.push(line);
      } else {
        out.push(line.replace(/m=(\S+)\s+\d+/, 'm=$1 0'));
      }
      continue;
    }
    if (!inMedia) {
      // session-level attrs
      if (line.startsWith('a=group:') || line.startsWith('a=msid-semantic:')) {
        out.push(line);
      } else if (line.startsWith('a=ice-lite')) {
        // skip
      } else if (
        line.startsWith('a=fingerprint:') ||
        line.startsWith('a=ice-ufrag:') ||
        line.startsWith('a=ice-pwd:') ||
        line.startsWith('a=extmap:') ||
        line.startsWith('a=setup:')
      ) {
        if (line.startsWith('a=setup:')) {
          out.push('a=setup:passive');
        } else {
          out.push(line);
        }
      }
      continue;
    }

    // media-level
    if (mediaKind !== 'audio') {
      continue;
    }
    if (line.startsWith('a=sendonly') || line.startsWith('a=sendrecv') || line.startsWith('a=recvonly') || line.startsWith('a=inactive')) {
      out.push('a=recvonly');
      continue;
    }
    if (line.startsWith('a=setup:')) {
      out.push('a=setup:passive');
      continue;
    }
    // Keep ICE/DTLS/rtpmap/fmtp/ssrc/mid/rtcp-mux etc.
    if (
      line.startsWith('a=') ||
      line.startsWith('c=') ||
      line.startsWith('b=')
    ) {
      out.push(line);
    }
  }

  // Ensure we have setup passive somewhere if missing
  if (!out.some((l) => l.startsWith('a=setup:'))) {
    out.push('a=setup:passive');
  }
  if (!out.some((l) => l === 'a=recvonly')) {
    // after first m=audio inject
    const idx = out.findIndex((l) => l.startsWith('m=audio'));
    if (idx >= 0) out.splice(idx + 1, 0, 'a=recvonly');
  }

  return `${out.join('\r\n')}\r\n`;
}

export function isLikelySdp(value: string): boolean {
  const s = String(value || '');
  return s.includes('v=0') && (s.includes('m=audio') || s.includes('m=application'));
}
