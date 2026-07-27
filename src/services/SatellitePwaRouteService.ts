import * as http from 'http';
import fs from 'fs';
import path from 'path';
import {
  SATELLITE_PWA_ROUTE_BASE,
  SATELLITE_WS_PATH,
} from '../contracts/SatelliteContract.js';

type WriteJsonResponse = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;

export type SatellitePwaAsset = {
  filePath: string;
  contentType: string;
  body: Buffer;
};

export class SatellitePwaRouteService {
  private readonly satelliteDir: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.satelliteDir = path.resolve(workspaceRoot, 'src', 'satellite');
  }

  public handleStaticRoute(
    pathname: string,
    res: http.ServerResponse,
    writeJson: WriteJsonResponse,
  ): boolean {
    const asset = this.resolveAsset(pathname);
    if (!asset) {
      if (pathname.startsWith(`${SATELLITE_PWA_ROUTE_BASE}/`)) {
        writeJson(res, { ok: false, error: 'Satellite asset not found.' }, 404);
        return true;
      }
      return false;
    }

    res.writeHead(200, {
      'Content-Type': asset.contentType,
      'Cache-Control': this.cacheControlFor(asset.filePath),
      'X-Zavorth-Satellite-WS': SATELLITE_WS_PATH,
    });
    res.end(asset.body);
    return true;
  }

  public resolveAsset(pathname: string): SatellitePwaAsset | null {
    const normalized = String(pathname || '').replace(/\/+$/, '') || SATELLITE_PWA_ROUTE_BASE;
    if (normalized !== SATELLITE_PWA_ROUTE_BASE && !normalized.startsWith(`${SATELLITE_PWA_ROUTE_BASE}/`)) {
      return null;
    }

    const relative = normalized === SATELLITE_PWA_ROUTE_BASE ? 'index.html'
      : decodeURIComponent(normalized.slice(SATELLITE_PWA_ROUTE_BASE.length + 1));
    const fileName = relative || 'index.html';
    if (fileName.includes('..') || path.isAbsolute(fileName)) {
      return null;
    }

    const candidate = path.resolve(this.satelliteDir, fileName);
    if (!candidate.startsWith(this.satelliteDir + path.sep) || !fs.existsSync(candidate)) {
      return null;
    }
    const stat = fs.statSync(candidate);
    if (!stat.isFile()) {
      return null;
    }

    return {
      filePath: candidate,
      contentType: this.contentTypeFor(candidate),
      body: fs.readFileSync(candidate),
    };
  }

  private contentTypeFor(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.html') return 'text/html; charset=utf-8';
    if (ext === '.css') return 'text/css; charset=utf-8';
    if (ext === '.js') return 'application/javascript; charset=utf-8';
    if (ext === '.json') return 'application/manifest+json; charset=utf-8';
    if (ext === '.svg') return 'image/svg+xml';
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    return 'application/octet-stream';
  }

  private cacheControlFor(filePath: string): string {
    return path.basename(filePath) === 'index.html'
      ? 'no-store'
      : 'public, max-age=300';
  }
}
