import fs from 'fs';
import os from 'os';
import path from 'path';
import { BaseTool } from '../../tools/BaseTool.js';
import type { ToolDefinition } from '../../providers/ILlmProvider.js';

export class SpotifyPlayerTool extends BaseTool {
  public readonly name = 'zavorth_spotify';

  public readonly description =
    'Spotify — music control. Play, pause, skip, busca, playlists, e current music information via Spotify Web API.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Acao: 'now_playing', 'play', 'pause', 'skip', 'previous', 'search', 'play_track', 'play_playlist', 'list_playlists', 'set_volume', 'get_devices', 'shuffle', 'repeat'.",
      },
      query: {
        type: 'string',
        description: 'Search term (para search).',
      },
      track_id: {
        type: 'string',
        description: 'Track ID or URI (para play_track).',
      },
      playlist_id: {
        type: 'string',
        description: 'Playlist ID (para play_playlist).',
      },
      device_id: {
        type: 'string',
        description: 'Device ID.',
      },
      volume: {
        type: 'number',
        description: 'Volume (0-100).',
      },
      search_type: {
        type: 'string',
        description: "Search type: 'track', 'artist', 'album', 'playlist'. Default: 'track'.",
      },
      state: {
        type: 'string',
        description: "Para shuffle/repeat: 'on', 'off', 'track', 'context'.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: 'action' parameter is required.';

    const accessToken = process.env.SPOTIFY_ACCESS_TOKEN;
    if (!accessToken) {
      return 'Error: SPOTIFY_ACCESS_TOKEN not configured. Get via OAuth at https://developer.spotify.com/dashboard';
    }

    const validActions = [
      'now_playing', 'play', 'pause', 'skip', 'previous', 'search',
      'play_track', 'play_playlist', 'list_playlists', 'set_volume',
      'get_devices', 'shuffle', 'repeat',
    ];
    if (!validActions.includes(action)) {
      return `Error: action "${action}" is invalid. Use: ${validActions.join(', ')}`;
    }

    try {
      switch (action) {
        case 'now_playing': return await this.nowPlaying(accessToken);
        case 'play': return await this.simpleAction(accessToken, 'PUT', '/me/player/play');
        case 'pause': return await this.simpleAction(accessToken, 'PUT', '/me/player/pause');
        case 'skip': return await this.simpleAction(accessToken, 'POST', '/me/player/next');
        case 'previous': return await this.simpleAction(accessToken, 'POST', '/me/player/previous');
        case 'search': return await this.search(args, accessToken);
        case 'play_track': return await this.playTrack(args, accessToken);
        case 'play_playlist': return await this.playPlaylist(args, accessToken);
        case 'list_playlists': return await this.listPlaylists(accessToken);
        case 'set_volume': return await this.setVolume(args, accessToken);
        case 'get_devices': return await this.getDevices(accessToken);
        case 'shuffle': return await this.setShuffle(args, accessToken);
        case 'repeat': return await this.setRepeat(args, accessToken);
        default: return `Error: action "${action}" is not implemented.`;
      }
    } catch (error: unknown) {
      return `Spotify error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async apiCall(accessToken: string, method: string, endpoint: string, body?: Record<string, unknown>): Promise<string> {
    const { execFileSync } = await import('child_process');
    const args = [
      '-s', '-X', method,
      '-H', `Authorization: Bearer ${accessToken}`,
      '-H', 'Content-Type: application/json',
    ];

    if (body) {
      const tmpFile = path.join(os.tmpdir(), `spotify_${Date.now()}.json`);
      fs.writeFileSync(tmpFile, JSON.stringify(body));
      args.push('-d', `@${tmpFile}`);
    }

    args.push(`https://api.spotify.com/v1${endpoint}`);

    const result = execFileSync('curl', args, { timeout: 15000, maxBuffer: 5 * 1024 * 1024 }).toString();
    if (body) {
      try { fs.unlinkSync(path.join(os.tmpdir(), `spotify_${Date.now()}.json`)); } catch { /* ignore */ }
    }
    return result;
  }

  private async nowPlaying(accessToken: string): Promise<string> {
    const result = await this.apiCall(accessToken, 'GET', '/me/player/currently-playing');
    if (!result || result.trim() === '') return 'No musica tocando no momento.';

    const parsed = JSON.parse(result);
    if (parsed.error) return `Error: ${parsed.error.message}`;

    const track = parsed.item;
    if (!track) return 'No musica tocando.';

    const artists = track.artists?.map((a: { name: string }) => a.name).join(', ') || 'Unknown';
    const progress = Math.floor((parsed.progress_ms || 0) / 1000);
    const duration = Math.floor((track.duration_ms || 0) / 1000);
    const isPlaying = parsed.is_playing;

    return [
      `${isPlaying ? '▶️' : '⏸️'} Tocando agora:`,
      `  Musica: ${track.name}`,
      `  Artista: ${artists}`,
      `  Album: ${track.album?.name || 'Unknown'}`,
      `  Progresso: ${this.formatTime(progress)} / ${this.formatTime(duration)}`,
      `  Dispositivo: ${parsed.device?.name || 'Unknown'}`,
      `  Volume: ${parsed.device?.volume_percent || 0}%`,
    ].join('\n');
  }

  private async simpleAction(accessToken: string, method: string, endpoint: string): Promise<string> {
    await this.apiCall(accessToken, method, endpoint);
    return 'OK';
  }

  private async search(args: Record<string, unknown>, accessToken: string): Promise<string> {
    const query = String(args.query || '');
    if (!query) return 'Error: "query" is required para search.';

    const type = String(args.search_type || 'track');
    const result = await this.apiCall(accessToken, 'GET', `/search?q=${encodeURIComponent(query)}&type=${type}&limit=10`);
    const parsed = JSON.parse(result);

    if (parsed.error) return `Error: ${parsed.error.message}`;

    const lines: string[] = [`Spotify Search: "${query}" (${type})`];

    if (parsed.tracks?.items) {
      for (const track of parsed.tracks.items.slice(0, 5)) {
        const artists = track.artists?.map((a: { name: string }) => a.name).join(', ');
        lines.push(`  🎵 ${track.name} — ${artists} (${this.formatTime(Math.floor(track.duration_ms / 1000))})`);
        lines.push(`     ID: ${track.id}`);
      }
    }

    if (parsed.artists?.items) {
      for (const artist of parsed.artists.items.slice(0, 5)) {
        lines.push(`  👤 ${artist.name} (${artist.followers?.total?.toLocaleString() || 0} seguidores)`);
      }
    }

    if (parsed.playlists?.items) {
      for (const pl of parsed.playlists.items.slice(0, 5)) {
        lines.push(`  📋 ${pl.name} (${pl.tracks?.total || 0} faixas)`);
      }
    }

    return lines.join('\n');
  }

  private async playTrack(args: Record<string, unknown>, accessToken: string): Promise<string> {
    const trackId = String(args.track_id || '');
    if (!trackId) return 'Error: "track_id" is required.';

    const uri = trackId.startsWith('spotify:track:') ? trackId : `spotify:track:${trackId}`;
    await this.apiCall(accessToken, 'PUT', '/me/player/play', { uris: [uri] });
    return `Tocando track: ${trackId}`;
  }

  private async playPlaylist(args: Record<string, unknown>, accessToken: string): Promise<string> {
    const playlistId = String(args.playlist_id || '');
    if (!playlistId) return 'Error: "playlist_id" is required.';

    const uri = `spotify:playlist:${playlistId}`;
    await this.apiCall(accessToken, 'PUT', '/me/player/play', { context_uri: uri });
    return `Tocando playlist: ${playlistId}`;
  }

  private async listPlaylists(accessToken: string): Promise<string> {
    const result = await this.apiCall(accessToken, 'GET', '/me/playlists?limit=20');
    const parsed = JSON.parse(result);

    if (parsed.error) return `Error: ${parsed.error.message}`;

    const lines: string[] = [`Playlists (${parsed.total || 0} total):`];
    for (const pl of (parsed.items || []).slice(0, 15)) {
      lines.push(`  📋 ${pl.name} (${pl.tracks?.total || 0} faixas) — ${pl.id}`);
    }
    return lines.join('\n');
  }

  private async setVolume(args: Record<string, unknown>, accessToken: string): Promise<string> {
    const volume = typeof args.volume === 'number' ? Math.max(0, Math.min(100, args.volume)) : 50;
    await this.apiCall(accessToken, 'PUT', `/me/player/volume?volume_percent=${volume}`);
    return `Volume alterado para ${volume}%.`;
  }

  private async getDevices(accessToken: string): Promise<string> {
    const result = await this.apiCall(accessToken, 'GET', '/me/player/devices');
    const parsed = JSON.parse(result);

    if (parsed.error) return `Error: ${parsed.error.message}`;

    const lines: string[] = ['Dispositivos Spotify:'];
    for (const device of (parsed.devices || [])) {
      const active = device.is_active ? '🔊' : '🔇';
      lines.push(`  ${active} ${device.name} (${device.type}) — Volume: ${device.volume_percent}% — ${device.id}`);
    }
    return lines.join('\n');
  }

  private async setShuffle(args: Record<string, unknown>, accessToken: string): Promise<string> {
    const state = String(args.state || 'on') === 'on';
    await this.apiCall(accessToken, 'PUT', `/me/player/shuffle?state=${state}`);
    return `Shuffle ${state ? 'ativado' : 'desativado'}.`;
  }

  private async setRepeat(args: Record<string, unknown>, accessToken: string): Promise<string> {
    const state = String(args.state || 'context');
    await this.apiCall(accessToken, 'PUT', `/me/player/repeat?state=${state}`);
    return `Repeat alterado para: ${state}`;
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}
