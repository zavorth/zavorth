import React, { useState, useEffect } from 'react';
import { render, Box, Text, Newline } from 'ink';

// ASCII Art do ZAVORTH-OS
const headerAscii = `
  ███████╗ █████╗ ██╗   ██╗ ██████╗ ██████╗ ████████╗ ██╗  ██╗
  ╚══███╔╝██╔══██╗██║   ██║██╔═══██╗██╔══██╗╚══██╔══╝ ██║  ██║
    ███╔╝ ███████║██║   ██║██║   ██║██████╔╝   ██║    ███████║
   ███╔╝  ██╔══██║╚██╗ ██╔╝██║   ██║██╔══██╗   ██║    ██╔══██║
  ███████╗██║  ██║ ╚████╔╝ ╚██████╔╝██║  ██║   ██║    ██║  ██║
  ╚══════╝╚═╝  ╚═╝  ╚═══╝   ╚═════╝ ╚═╝  ╚═╝   ╚═╝    ╚═╝  ╚═╝
`;

// ASCII Art da Raposa (Fox)
const foxAscii = `
        /\\   /\\
       //\\\\_//\\\\
       \\_     _/
        / * * \\
        \\  ^  /
         \\___/
`;

const theme = {
  primary: '#FFB86C',   // Amber/Laranja (principal)
  secondary: '#6272A4', // Cinza/Azul (dim/bordas)
  accent: '#8BE9FD',    // Ciano (destaques)
  success: '#50FA7B',   // Verde (sucesso)
};

const Dashboard = () => {
  const [loadingBar, setLoadingBar] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setLoadingBar(prev => (prev >= 100 ? 0 : prev + 5));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Cabeçalho Zavorth */}
      <Box justifyContent="center">
        <Text color={theme.primary}>{headerAscii}</Text>
      </Box>

      {/* Linha da Versão */}
      <Box justifyContent="center" marginTop={1} marginBottom={1}>
        <Text color={theme.secondary}>─────── </Text>
        <Text color={theme.primary}> Zavorth OS v1.1.0 (2026.05.13) • upstream 8a9b2c3 </Text>
        <Text color={theme.secondary}> ───────</Text>
      </Box>

      {/* Main Grid: Escudo + Capabilities */}
      <Box flexDirection="row" justifyContent="space-between" width="100%" paddingX={2}>
        
        {/* Coluna Esquerda: Símbolo e Sessão */}
        <Box flexDirection="column" width="40%">
          <Text color={theme.primary}>{foxAscii}</Text>
          <Box flexDirection="column" marginTop={1} marginLeft={4}>
            <Text>
              <Text color={theme.primary}>mode: </Text>
              <Text color={theme.accent}>governed-dev</Text>
            </Text>
            <Text>
              <Text color={theme.secondary}>user: </Text>
              <Text color={theme.secondary}>zavorth-owner</Text>
            </Text>
            <Text color={theme.secondary}>session: 20260513_1532</Text>
          </Box>
        </Box>

        {/* Coluna Direita: Tools e Skills */}
        <Box flexDirection="column" width="60%">
          
          <Box flexDirection="column" marginBottom={1}>
            <Text color={theme.primary} bold>Available Capabilities (Gateways)</Text>
            <Box flexDirection="column" marginLeft={2}>
              <Text><Text color={theme.secondary}>policy: </Text>broker_check, receipt_issue, vault_access</Text>
              <Text><Text color={theme.secondary}>mesh:   </Text>telegram_send, whatsapp_notify, satellite_ping</Text>
              <Text><Text color={theme.secondary}>exec:   </Text>stitch_run, bash_sandboxed, apply_patch</Text>
              <Text><Text color={theme.secondary}>vision: </Text>browser_cdp, computer_use, screen_capture</Text>
              <Text color={theme.secondary}>(and 8 more capabilities...)</Text>
            </Box>
          </Box>

          <Box flexDirection="column">
            <Text color={theme.primary} bold>Available Subagents (Skills)</Text>
            <Box flexDirection="column" marginLeft={2}>
              <Text><Text color={theme.secondary}>trust-plane:  </Text>policy-broker, cognitive-firewall</Text>
              <Text><Text color={theme.secondary}>development:  </Text>coder, qa-auditor, repo-map</Text>
              <Text><Text color={theme.secondary}>security:     </Text>prompt-injection-defense, code-review</Text>
              <Text><Text color={theme.secondary}>ops:          </Text>incident-triage, dashboard-ops</Text>
              <Text><Text color={theme.secondary}>research:     </Text>document-analysis, web-research-governed</Text>
            </Box>
          </Box>

          <Box marginTop={1} marginLeft={2}>
            <Text color={theme.secondary}>24 tools • 5 profiles • /help for commands</Text>
          </Box>

        </Box>
      </Box>

      {/* Linha Separadora */}
      <Box borderStyle="single" borderColor={theme.secondary} borderTop={false} borderLeft={false} borderRight={false} marginTop={1} marginBottom={1} />

      {/* Terminal Area (Chat) */}
      <Box flexDirection="column" paddingX={2}>
        <Text color={theme.secondary}>Welcome to Zavorth OS! Type your command or /help.</Text>
        <Text color={theme.accent}>✦ Tip: Run `zavorth doctor --advanced` to verify sandbox integrity.</Text>
        
        <Box marginTop={1} marginBottom={1}>
          <Text color={theme.primary}>▲ Policy Broker enabled: All mutating actions require visual receipts.</Text>
        </Box>

        <Text color={theme.primary}>● user</Text>
        <Text>Initialize the web-console terminal projection.</Text>
        <Newline />
        
        <Box borderStyle="single" borderColor={theme.secondary} borderTop={false} borderLeft={false} borderRight={false} width={30} marginBottom={1} />

        <Text color={theme.primary}>⚡ Zavorth (Planner)</Text>
        <Text>Understood. Spinning up the new TUI dashboard powered by Ink.</Text>
      </Box>

      {/* Status Bar */}
      <Box 
        borderStyle="single" 
        borderColor={theme.secondary} 
        paddingX={1} 
        marginTop={2}
        flexDirection="row"
        justifyContent="space-between"
      >
        <Box>
          <Text color={theme.primary}>⚡ zavorth-v1</Text>
          <Text color={theme.secondary}> │ </Text>
          <Text color={theme.secondary}>budget: </Text>
          <Text color={theme.success}>$0.04/$5.00</Text>
        </Box>
        <Box>
          <Text color={theme.secondary}>[</Text>
          <Text color={theme.primary}>{'█'.repeat(Math.floor(loadingBar / 10))}</Text>
          <Text color={theme.secondary}>{' '.repeat(10 - Math.floor(loadingBar / 10))}</Text>
          <Text color={theme.secondary}>] </Text>
          <Text color={theme.primary}>{loadingBar}%</Text>
          <Text color={theme.secondary}> │ </Text>
          <Text color={theme.secondary}>12s</Text>
          <Text color={theme.secondary}> │ </Text>
          <Text color={theme.secondary}>mem: 45MB</Text>
        </Box>
      </Box>

      {/* Prompt Line */}
      <Box marginTop={1} marginLeft={1}>
        <Text color={theme.primary}>❯ </Text>
      </Box>

    </Box>
  );
};

console.clear();
render(<Dashboard />);
