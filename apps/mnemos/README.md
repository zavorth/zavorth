# Mnemos Cognitive Engine

Motor de memoria vetorial local do Zavorth.

O Mnemos roda como um servidor MCP (Model Context Protocol) isolado em container Docker.
Ele expoe tools de busca semantica, varredura de metadados e indexacao de arquivos para o
orquestrador Zavorth via Standard I/O (`stdin/stdout`).

## Arquitetura

```text
Zavorth Core (Node.js / TypeScript)
  McpRuntimeService
    McpClientManager("mnemos")
      StdioClientTransport -> scripts/start-mnemos-mcp.mjs -> docker run
    ToolRegistry
      search_memory
      scan_local_metadata
      index_file
      vault_status
      delete_memory

Docker Container (mnemos-cognitive-engine)
  server.py (MCP Server - Python 3.11)
    ChromaDB (banco vetorial persistente)
    Sentence Transformers (embeddings)
    pdftotext / PyPDF2 (extracao de PDFs)

Volumes Docker
  /app/data/vault      <- pasta de vault configurada pelo usuario
  /app/data/vector_db  <- ChromaDB persistente
  /scan_volumes/N      <- pastas autorizadas para scan, montadas read-only
```

## Tools Expostas

| Tool | Estagio | Descricao |
| --- | --- | --- |
| `search_memory` | 1 | Busca semantica vetorial no banco indexado |
| `scan_local_metadata` | 2 | Varredura leve de nomes/metadados em diretorios autorizados |
| `index_file` | 3 | Indexa um arquivo no banco vetorial quando o Zavorth aprova a chamada |
| `vault_status` | - | Estatisticas do banco, uso de disco e volumes montados |
| `delete_memory` | - | Remove documentos do banco vetorial, nao arquivos do disco |

## Setup

### 1. Build da imagem Docker

Execute a partir da raiz do Zavorth:

```bash
docker build -t mnemos-cognitive-engine:latest apps/mnemos
```

Tambem funciona entrar em `apps/mnemos` e rodar:

```bash
docker build -t mnemos-cognitive-engine:latest .
```

### 2. Configurar variaveis de ambiente

No `.env` do Zavorth, configure os diretorios que o Mnemos pode acessar:

```env
MNEMOS_VAULT_DIR=C:\Mnemos_Vault
MNEMOS_SCAN_DIRS=%USERPROFILE%\Downloads;%USERPROFILE%\Documents
MNEMOS_DB_DIR=C:\Mnemos_Data\vector_db
```

No Windows, `MNEMOS_SCAN_DIRS` aceita multiplas pastas separadas por ponto e virgula (`;`).
Cada pasta e montada no container como `/scan_volumes/0`, `/scan_volumes/1`, etc.

### 3. Boot automatico

O Zavorth conecta ao Mnemos no boot via `McpRuntimeService`, usando a entrada `"mnemos"`
do manifesto `config/mcp-servers.json`. O launcher versionado e:

```bash
node scripts/start-mnemos-mcp.mjs
```

## Garantias e Limites

- O container roda com `--network none`, reforcando a promessa local-first.
- Diretorios de scan sao montados como read-only.
- O usuario decide quais pastas entram em `MNEMOS_SCAN_DIRS`.
- `scan_local_metadata` faz uma varredura leve de nomes/metadados.
- `index_file` extrai texto e grava chunks no ChromaDB em `/app/data/vector_db`.
- A aprovacao humana nao acontece dentro de `server.py`; ela deve ser aplicada pelo Zavorth antes de chamar `index_file`.
- `server.py` confia nos volumes montados pelo Docker. Ele nao faz, sozinho, uma allowlist interna rigorosa de path sob `/scan_volumes`.
- `/app/data/vault` e uma pasta persistente configuravel, mas a memoria vetorial persistente principal fica em `/app/data/vector_db`.

## Teste E2E Opcional

Com Docker Desktop ativo:

```bash
npm run test:mnemos:e2e
```

O teste cria diretorios temporarios, inicia o MCP em container, chama `vault_status`,
`scan_local_metadata`, `index_file` e `search_memory`, e encerra o processo ao final.
