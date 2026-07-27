import { CommandParser } from '../../src/telegram/CommandParser';

describe('CommandParser', () => {
  const parser = new CommandParser();

  it('maps /external to the explicit external_executor executor', () => {
    const parsed = parser.parse('/external revise o bootstrap');

    expect(parsed.command_type).toBe('/external');
    expect(parsed.command_args).toBe('revise o bootstrap');
    expect(parsed.explicit_executor).toBe('external_executor');
  });

  it('maps /oc to /external', () => {
    const parsed = parser.parse('/oc verifique o workspace');

    expect(parsed.command_type).toBe('/external');
    expect(parsed.command_args).toBe('verifique o workspace');
    expect(parsed.explicit_executor).toBe('external_executor');
  });

  it('maps /oc with a bot mention to /external', () => {
    const parsed = parser.parse('/oc@ZavorthBot verifique o workspace');

    expect(parsed.command_type).toBe('/external');
    expect(parsed.command_args).toBe('verifique o workspace');
    expect(parsed.explicit_executor).toBe('external_executor');
  });

  it('maps /codeassist to /gemini as a compatibility alias', () => {
    const parsed = parser.parse('/codeassist revise o modulo atual');

    expect(parsed.command_type).toBe('/gemini');
    expect(parsed.command_args).toBe('revise o modulo atual');
    expect(parsed.explicit_executor).toBe('gemini_cli');
  });

  it('maps /gaistudio to /aistudio', () => {
    const parsed = parser.parse('/gaistudio tools=search summarize AI news');

    expect(parsed.command_type).toBe('/aistudio');
    expect(parsed.command_args).toBe('tools=search summarize AI news');
    expect(parsed.explicit_executor).toBe('aistudio');
  });

  it('maps /stich to /stitch as a compatibility alias', () => {
    const parsed = parser.parse('/stich generate a landing page for a restaurant');

    expect(parsed.command_type).toBe('/stitch');
    expect(parsed.command_args).toBe('generate a landing page for a restaurant');
    expect(parsed.explicit_executor).toBe('stitch');
  });

  it('normalizes admin commands with bot mentions', () => {
    const parsed = parser.parse('/ban@ZavorthBot 123456');

    expect(parsed.command_type).toBe('/ban');
    expect(parsed.command_args).toBe('123456');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps /perm as a non-executor command', () => {
    const parsed = parser.parse('/perm approve abc123');

    expect(parsed.command_type).toBe('/perm');
    expect(parsed.command_args).toBe('approve abc123');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps /permallow as a top-level non-executor command', () => {
    const parsed = parser.parse('/permallow executor=external_executor kind=folder value="C:/repo"');

    expect(parsed.command_type).toBe('/permallow');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps /permrevoke as a top-level non-executor command', () => {
    const parsed = parser.parse('/permrevoke abc123');

    expect(parsed.command_type).toBe('/permrevoke');
    expect(parsed.command_args).toBe('abc123');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps /zavorth as a top-level non-executor command', () => {
    const parsed = parser.parse('/zavorth');

    expect(parsed.command_type).toBe('/zavorth');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps /capabilities as a top-level non-executor command', () => {
    const parsed = parser.parse('/capabilities');

    expect(parsed.command_type).toBe('/capabilities');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps /integrations as a top-level non-executor command', () => {
    const parsed = parser.parse('/integrations openrouter');

    expect(parsed.command_type).toBe('/integrations');
    expect(parsed.command_args).toBe('openrouter');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps /connect as a top-level non-executor command', () => {
    const parsed = parser.parse('/connect zerocloud docker');

    expect(parsed.command_type).toBe('/connect');
    expect(parsed.command_args).toBe('zerocloud docker');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps /start as a top-level non-executor command', () => {
    const parsed = parser.parse('/start tour');

    expect(parsed.command_type).toBe('/start');
    expect(parsed.command_args).toBe('tour');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps /settings as a top-level non-executor command', () => {
    const parsed = parser.parse('/settings');

    expect(parsed.command_type).toBe('/settings');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('maps /app to /zavorthcontrol as a top-level non-executor command', () => {
    const parsed = parser.parse('/app');

    expect(parsed.command_type).toBe('/zavorthcontrol');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('maps /miniapp to /zavorthcontrol for backwards compatibility', () => {
    const parsed = parser.parse('/miniapp');

    expect(parsed.command_type).toBe('/zavorthcontrol');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps /schedule as a non-executor operational command', () => {
    const parsed = parser.parse('/schedule every 1h /wsl status');

    expect(parsed.command_type).toBe('/schedule');
    expect(parsed.command_args).toBe('every 1h /wsl status');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('maps /bridge to the ZavorthBridge executor', () => {
    const parsed = parser.parse('/bridge continue a tarefa atual');

    expect(parsed.command_type).toBe('/bridge');
    expect(parsed.command_args).toBe('continue a tarefa atual');
    expect(parsed.explicit_executor).toBe('zavorthBridge');
  });

  it('maps /aga to /ag for ZavorthBridge backwards compatibility', () => {
    const parsed = parser.parse('/aga research today news');

    expect(parsed.command_type).toBe('/ag');
    expect(parsed.command_args).toBe('research today news');
    expect(parsed.explicit_executor).toBe('zavorthBridge');
  });

  it('keeps /task as an explicit hidden conversational command', () => {
    const parsed = parser.parse('/task revise a arquitetura atual');

    expect(parsed.command_type).toBe('/task');
    expect(parsed.command_args).toBe('revise a arquitetura atual');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps explicit /echo commands available as operator shortcuts', () => {
    const parsed = parser.parse('/echo on');

    expect(parsed.command_type).toBe('/echo');
    expect(parsed.command_args).toBe('on');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps /auto as an explicit hidden autonomous command', () => {
    const parsed = parser.parse('/auto corrija o file atual');

    expect(parsed.command_type).toBe('/auto');
    expect(parsed.command_args).toBe('corrija o file atual');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('maps /external-review to the canonical underscore command', () => {
    const parsed = parser.parse('/external-review revisar pipeline');

    expect(parsed.command_type).toBe('/external_review');
    expect(parsed.command_args).toBe('revisar pipeline');
    expect(parsed.explicit_executor).toBe('workflow:review');
  });

  it('keeps /selfmod as a recognized hidden command', () => {
    const parsed = parser.parse('/selfmod src/telegram/AuthGuard.ts -- endurecer o guard');

    expect(parsed.command_type).toBe('/selfmod');
    expect(parsed.command_args).toBe('src/telegram/AuthGuard.ts -- endurecer o guard');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('maps /selfmodify to /selfmod', () => {
    const parsed = parser.parse('/selfmodify src/telegram/AuthGuard.ts -- endurecer o guard');

    expect(parsed.command_type).toBe('/selfmod');
    expect(parsed.command_args).toBe('src/telegram/AuthGuard.ts -- endurecer o guard');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps /changes as a recognized operational command', () => {
    const parsed = parser.parse('/changes');

    expect(parsed.command_type).toBe('/changes');
    expect(parsed.command_args).toBe('');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('maps /reload to /selfupdate', () => {
    const parsed = parser.parse('/reload force');

    expect(parsed.command_type).toBe('/selfupdate');
    expect(parsed.command_args).toBe('force');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('maps /repair to /autorepair', () => {
    const parsed = parser.parse('/repair dryrun');

    expect(parsed.command_type).toBe('/autorepair');
    expect(parsed.command_args).toBe('dryrun');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('marks short follow-up messages as references to the latest task', () => {
    const parsed = parser.parse('cade-');

    expect(parsed.command_type).toBe('/task');
    expect(parsed.references_last_task).toBe(true);
  });

  it('maps /sendfile to /file', () => {
    const parsed = parser.parse('/sendfile downloads report.pdf');

    expect(parsed.command_type).toBe('/file');
    expect(parsed.command_args).toBe('downloads report.pdf');
    expect(parsed.explicit_executor).toBeNull();
  });

  it('keeps natural Echo wording on the task path so the agent loop can decide', () => {
    expect(parser.parse('echo on')).toEqual(expect.objectContaining({
      command_type: '/task',
      command_args: 'echo on',
      explicit_executor: null,
    }));
    expect(parser.parse('desligar echo')).toEqual(expect.objectContaining({
      command_type: '/task',
      command_args: 'desligar echo',
      explicit_executor: null,
    }));
  });

  it('marks short operational follow-ups as referencing the last task', () => {
    const parsed = parser.parse('cade-');

    expect(parsed.command_type).toBe('/task');
    expect(parsed.references_last_task).toBe(true);
  });
});
