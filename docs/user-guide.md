# Guia do Usuário — Zavorth

Guia completo para usar o Zavorth no dia a dia.

## Início Rápido

```bash
# Instalar
npm install -g zavorth@latest

# Configurar (guiado)
zavorth setup

# Iniciar
zavorth start

# Abrir dashboard
zavorth open
```

## Comandos Principais

| Comando | O que faz |
|---------|-----------|
| `zavorth setup` | Configuração guiada (provedores, canais, idioma) |
| `zavorth start` | Inicia o runtime em background |
| `zavorth open` | Abre o dashboard no navegador |
| `zavorth chat` | Sessão de chat no terminal |
| `zavorth ask "..."` | Pergunta única governada |
| `zavorth doctor` | Diagnóstico do sistema |
| `zavorth ready` | Verifica se tudo está pronto |

## Idioma

O Zavorth detecta automaticamente o idioma do seu notebook via variáveis de ambiente (`LANG`, `LC_ALL`, etc.).

```bash
# Forçar idioma
ZAVORTH_LANG=pt-BR zavorth start

# Idiomas suportados
en-US, pt-BR, es-ES, fr-FR, de-DE, it-IT, ja-JP, zh-CN, ko-KR, ru-RU, ar-SA
```

Para adicionar um novo idioma, crie `src/i18n/locales/<locale>/` com arquivos YAML. Sem alteração de código.

## Perfis de Instância

Execute múltiplas instâncias isoladas do Zavorth (ex: pessoal vs trabalho):

```bash
# Criar instância
zavorth instance create work

# Trocar de instância (grava no .env)
zavorth instance switch work

# Ver instâncias
zavorth instance list

# Ver instância atual
zavorth instance current

# Deletar instância
zavorth instance delete old-work
```

Cada instância tem sua própria: database, memória, sessões, credenciais, config.

## Provedores LLM

O Zavorth suporta 60+ provedores. Configure via `zavorth setup` ou manualmente:

```bash
# Ver provedores disponíveis
zavorth providers

# Adicionar provedor
zavorth providers add --provider=openai

# Verificar status
zavorth providers status
```

## Canais de Mensagem

O Zavorth se conecta a 29+ plataformas: Telegram, Discord, WhatsApp, Slack, Signal, iMessage, Teams, Email, Instagram, Matrix, IRC, LINE, Google Chat, QQ, Zalo, WeChat, e mais.

```bash
# Ver canais
zavorth channels

# Conectar Telegram
zavorth channels telegram
```

## Cron / Automação

Agende tarefas recorrentes com entrega multi-plataforma:

```bash
# Criar tarefa agendada
zavorth cron add --command '/report daily' --delivery telegram

# Entregar via Slack
zavorth cron add --command '/status' --delivery slack

# Entregar via WhatsApp
zavorth cron add --command '/check' --delivery whatsapp --target '+5511999999999'

# Listar tarefas
zavorth cron list
```

Aceita expressões cron (`0 9 * * *`), intervalos (`every 2h`), e timestamps ISO.

## Segurança

- **Approval gates**: ações sensíveis pedem aprovação antes de executar
- **Receipts**: cada ação gera um registro auditável
- **Scoped permissions**: permissões expiram, são limitadas por canal/ação
- **No secret leaks**: credenciais nunca aparecem em logs ou prompts

## Desktop App

O app desktop (Electron) inclui:
- Terminal com xterm.js (cursor, scrollback, cores)
- Sidebar com navegação
- Command palette (Ctrl+K)
- Aprovações interativas
- Workspace scopes

## Solução de Problemas

```bash
# Diagnóstico completo
zavorth doctor

# Ver logs
zavorth doctor --verbose

# Exportar diagnósticos
zavorth diagnostics export
```
