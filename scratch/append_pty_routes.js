const fs = require('fs');

const file = 'src/services/ZavorthControlCoreRouteService.ts';
let content = fs.readFileSync(file, 'utf8');

const importsToAdd = `
import { PtySessionService } from './PtySessionService.js';
import { PtySessionApprovalService } from './PtySessionApprovalService.js';
import { PtyInputApprovalService } from './PtyInputApprovalService.js';
`;

if (!content.includes('PtySessionService')) {
  content = content.replace('import { HostPowerModeService } from \'./HostPowerModeService.js\';', `import { HostPowerModeService } from './HostPowerModeService.js';\n${importsToAdd}`);
}

const routesToAdd = `
    // --- PTY Routes ---
    
    if (pathname === '/api/v2/workspace/pty/pending-sessions' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = parsedUrl.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId required' }, 400);
          return true;
        }
        const srv = new PtySessionApprovalService();
        const pending = await srv.getPendingProposals(workspaceId);
        deps.writeJson(res, { ok: true, data: pending });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/pty/resolve-session' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const { workspaceId, sessionId, approve } = await deps.readJsonBody(req);
        if (!workspaceId || !sessionId || approve === undefined) {
          deps.writeJson(res, { ok: false, error: 'Missing parameters' }, 400);
          return true;
        }
        const srv = new PtySessionApprovalService();
        await srv.resolveProposal(workspaceId, sessionId, approve);
        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/pty/pending-inputs' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = parsedUrl.searchParams.get('workspaceId');
        if (!workspaceId) {
          deps.writeJson(res, { ok: false, error: 'workspaceId required' }, 400);
          return true;
        }
        const srv = new PtyInputApprovalService();
        const pending = await srv.getPendingProposals(workspaceId);
        deps.writeJson(res, { ok: true, data: pending });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/pty/resolve-input' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const { workspaceId, operationId, sessionId, approve, strongConfirmationInput } = await deps.readJsonBody(req);
        if (!workspaceId || !operationId || !sessionId || approve === undefined) {
          deps.writeJson(res, { ok: false, error: 'Missing parameters' }, 400);
          return true;
        }
        const inputSrv = new PtyInputApprovalService();
        await inputSrv.resolveProposal(workspaceId, operationId, approve, strongConfirmationInput);

        if (approve) {
          // Attempt to consume and run immediately for convenience
          const consumed = await inputSrv.consumeApproval(operationId, sessionId, workspaceId);
          if (consumed) {
             // We need the raw input which was stored hashed, but actually wait, we don't have it here. 
             // Ah, PtyInputPolicyService created the pending input. The tool has to retry, or we run it?
             // The user approves it. Then the agent tool gets a signal, or the frontend runs it?
             // Actually, if it's "input", the frontend doesn't have the raw input unless it's in the DB.
             // Wait! The DB does not persist raw input, only hash! So the agent MUST retry the tool call!
             // So here we only approve.
          }
        }

        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/pty/output' && req.method === 'GET') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const workspaceId = parsedUrl.searchParams.get('workspaceId');
        const sessionId = parsedUrl.searchParams.get('sessionId');
        const afterSeqStr = parsedUrl.searchParams.get('afterSeq');
        if (!workspaceId || !sessionId) {
          deps.writeJson(res, { ok: false, error: 'Missing parameters' }, 400);
          return true;
        }
        const afterSeq = afterSeqStr ? parseInt(afterSeqStr, 10) : 0;
        
        const chunks = PtySessionService.getInstance().getOutput(sessionId, afterSeq);
        deps.writeJson(res, { ok: true, data: chunks });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }

    if (pathname === '/api/v2/workspace/pty/terminate' && req.method === 'POST') {
      if (deps.authService && !deps.authService.resolveAuthenticatedIdentity(req)) {
        deps.writeJson(res, { ok: false, error: 'Unauthorized' }, 401);
        return true;
      }
      try {
        const { workspaceId, sessionId } = await deps.readJsonBody(req);
        if (!workspaceId || !sessionId) {
          deps.writeJson(res, { ok: false, error: 'Missing parameters' }, 400);
          return true;
        }
        await PtySessionService.getInstance().terminateSession(sessionId, workspaceId);
        deps.writeJson(res, { ok: true });
      } catch (err: any) {
        deps.writeJson(res, { ok: false, error: err.message }, 500);
      }
      return true;
    }
`;

if (!content.includes('/api/v2/workspace/pty/pending-sessions')) {
  // Insert right before host-power routes
  const hostPowerMarker = "if (pathname === '/api/v2/workspace/host-power/status'";
  if (content.includes(hostPowerMarker)) {
    content = content.replace(hostPowerMarker, routesToAdd + "\n    " + hostPowerMarker);
  } else {
    console.error("Could not find insertion marker");
    process.exit(1);
  }
}

fs.writeFileSync(file, content);
console.log('Routes added successfully.');
