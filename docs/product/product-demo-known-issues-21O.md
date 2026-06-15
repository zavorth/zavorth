# Zavorth - Demo Known Issues (Phase 21O)

> [!IMPORTANT]
> **Nota de Auditoria/Escopo**:
> - Esta fase não entrega build para testers.
> - Não há installer publicado.
> - Não há pacote público.
> - Não há release público.
> - Não há push remoto.

Este documento consolida os problemas identificados, polimentos visuais e melhorias de usabilidade organizadas por prioridade.

---

## Classificação de Problemas

### Prioridade P0 (Bloqueia demonstrações ou uso básico)
- *Nenhum identificado.* A usabilidade está funcional e atende aos requisitos básicos da demo.

### Prioridade P1 (Necessário polir antes de demonstração real para testers externos)
- *Nenhum identificado.* As telas principais (Cockpit Dashboard, Workspace Settings, Setup de Provedores) e a CLI foram testadas e normalizadas contra vazamento de credenciais e erros crus.

### Prioridade P2 (Pode ir como known issue listado)
1. **Configuração de Provedor via IP local**: Ao adicionar um provedor de IA apontando para IP de rede local privada sem HTTPS, o indicador de conexão pode avisar que a conexão não é recomendada por segurança, mas permite prosseguir.
2. **Suporte de Terminal PTY em Windows**: Algumas fontes customizadas de terminal Powershell podem causar desalinhamento leve nos caracteres de borda do prompt de aprovação interativo.

### Prioridade P3 (Backlog de usabilidade/produto)
1. **Histórico de Execuções**: Adicionar uma aba no Cockpit para listar as últimas 10 tarefas do agente e seus respectivos hashes de auditoria.
2. **Auto-diagnóstico Preventivo**: Adicionar um botão "Recalcular Diagnósticos" no painel principal para re-avaliar o status sem precisar recarregar o app.
