"""
Mnemos Cognitive Engine — MCP Server (Model Context Protocol)

Motor de Memória Local do Zavorth.
Expõe tools de busca semântica, varredura de metadados e indexação de arquivos
via protocolo MCP sobre Standard I/O (stdin/stdout).

O Zavorth Core (Node.js) consome este servidor como um child process,
registrando automaticamente as tools no ToolRegistry do agente.

Arquitetura:
  - ChromaDB: Banco vetorial local para armazenamento de embeddings.
  - SentenceTransformers: Modelo local leve para geração de vetores.
  - Watchdog: Sentinela assíncrona para indexação automática do cofre.

Segurança:
  - Este servidor roda em container Docker isolado.
  - Os diretórios de varredura são montados como volumes READ-ONLY.
  - Nenhum arquivo do host é acessado sem autorização explícita do usuário.
"""

import os
import sys
import json
import logging
from pathlib import Path
from typing import Optional

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import TextContent, Tool

# ---------------------------------------------------------------------------
# Configuração
# ---------------------------------------------------------------------------

CHROMA_DB_DIR = os.environ.get("MNEMOS_CHROMA_DB_DIR", "/app/data/vector_db")
SCAN_VOLUMES_BASE = os.environ.get("MNEMOS_SCAN_VOLUMES", "/scan_volumes")
VAULT_DIR = os.environ.get("MNEMOS_VAULT_DIR", "/app/data/vault")
EMBEDDING_MODEL = os.environ.get("MNEMOS_EMBEDDING_MODEL", "all-MiniLM-L6-v2")
MAX_SCAN_DEPTH = int(os.environ.get("MNEMOS_MAX_SCAN_DEPTH", "5"))
MAX_RESULTS = int(os.environ.get("MNEMOS_MAX_RESULTS", "10"))

logging.basicConfig(
    level=logging.INFO,
    format="[Mnemos] %(asctime)s %(levelname)s %(message)s",
    stream=sys.stderr,  # Importante: logs vão pra stderr, stdout é reservado pro MCP
)
logger = logging.getLogger("mnemos")

# ---------------------------------------------------------------------------
# Motor Vetorial (Lazy-loaded para economia de RAM)
# ---------------------------------------------------------------------------

_chroma_client = None
_chroma_collection = None
_embedding_function = None


def _get_embedding_function():
    """Carrega o modelo de embedding local sob demanda."""
    global _embedding_function
    if _embedding_function is None:
        try:
            from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction
            logger.info(f"Carregando modelo de embedding: {EMBEDDING_MODEL}")
            _embedding_function = SentenceTransformerEmbeddingFunction(
                model_name=EMBEDDING_MODEL,
            )
            logger.info("Modelo de embedding carregado com sucesso.")
        except Exception as e:
            logger.error(f"Falha ao carregar modelo de embedding: {e}")
            raise
    return _embedding_function


def _get_collection():
    """Inicializa o ChromaDB e retorna a collection principal."""
    global _chroma_client, _chroma_collection
    if _chroma_collection is None:
        import chromadb

        persist_dir = Path(CHROMA_DB_DIR)
        persist_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"Inicializando ChromaDB em: {persist_dir}")
        _chroma_client = chromadb.PersistentClient(path=str(persist_dir))
        _chroma_collection = _chroma_client.get_or_create_collection(
            name="mnemos_vault",
            embedding_function=_get_embedding_function(),
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            f"Collection 'mnemos_vault' pronta. Documentos atuais: {_chroma_collection.count()}"
        )
    return _chroma_collection


# ---------------------------------------------------------------------------
# Extração de Texto
# ---------------------------------------------------------------------------

SUPPORTED_EXTENSIONS = {".txt", ".md", ".py", ".ts", ".js", ".json", ".csv", ".log", ".html", ".xml", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".tex", ".rst"}
PDF_EXTENSIONS = {".pdf"}


def _extract_text(file_path: str) -> Optional[str]:
    """Extrai texto de um arquivo, suportando texto puro e PDFs."""
    fp = Path(file_path)
    if not fp.exists():
        return None

    ext = fp.suffix.lower()

    if ext in SUPPORTED_EXTENSIONS:
        try:
            return fp.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            logger.warning(f"Falha ao ler texto de {file_path}: {e}")
            return None

    if ext in PDF_EXTENSIONS:
        try:
            import subprocess
            # Usa pdftotext se disponível no container
            result = subprocess.run(
                ["pdftotext", file_path, "-"],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except FileNotFoundError:
            pass
        except Exception as e:
            logger.warning(f"Falha pdftotext em {file_path}: {e}")

        # Fallback: PyPDF2
        try:
            from PyPDF2 import PdfReader
            reader = PdfReader(file_path)
            pages = []
            for page in reader.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            return "\n\n".join(pages) if pages else None
        except ImportError:
            logger.warning("PyPDF2 não instalado, PDF não pode ser extraído.")
            return None
        except Exception as e:
            logger.warning(f"Falha PyPDF2 em {file_path}: {e}")
            return None

    return None


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Divide texto em chunks com sobreposição para melhor recall na busca."""
    if len(text) <= chunk_size:
        return [text]

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap

    return chunks


# ---------------------------------------------------------------------------
# Servidor MCP
# ---------------------------------------------------------------------------

server = Server("mnemos-cognitive-engine")


@server.list_tools()
async def list_tools() -> list[Tool]:
    """Declara ao Zavorth quais ferramentas o Mnemos oferece."""
    return [
        Tool(
            name="search_memory",
            description=(
                "Pesquisa o banco de memória vetorial local do Mnemos por "
                "fragmentos de conhecimento semanticamente relevantes à query. "
                "Use para buscar anotações, trechos de PDFs, e conteúdos "
                "previamente indexados pelo usuário. [Estágio 1 - Zona Quente]"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "A pergunta ou frase de busca semântica.",
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Quantidade máxima de resultados.",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        ),
        Tool(
            name="scan_local_metadata",
            description=(
                "Varre os diretórios autorizados pelo usuário procurando arquivos "
                "cujo nome contenha as palavras-chave fornecidas. Busca leve por "
                "metadados, sem ler o conteúdo dos arquivos. Ideal quando a busca "
                "vetorial não encontrar nada. [Estágio 2 - Radar Leve]"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "keywords": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Lista de palavras-chave para filtrar nomes de arquivos.",
                    },
                    "extensions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Extensões de arquivo opcionais para filtrar (ex: ['.pdf', '.docx']).",
                    },
                },
                "required": ["keywords"],
            },
        ),
        Tool(
            name="index_file",
            description=(
                "Lê, extrai texto e indexa um arquivo específico no banco vetorial. "
                "Use após o usuário confirmar que deseja indexar um arquivo encontrado "
                "pelo scan de metadados. [Estágio 3 - Indexação sob demanda]"
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "file_path": {
                        "type": "string",
                        "description": "Caminho absoluto do arquivo a indexar (dentro dos volumes montados).",
                    },
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Tags opcionais para categorizar o documento.",
                    },
                },
                "required": ["file_path"],
            },
        ),
        Tool(
            name="vault_status",
            description=(
                "Retorna estatísticas do cofre de memória: quantidade de documentos "
                "indexados, espaço em disco, diretórios monitorados, etc."
            ),
            inputSchema={
                "type": "object",
                "properties": {},
            },
        ),
        Tool(
            name="delete_memory",
            description=(
                "Remove um documento específico do banco vetorial por ID ou nome de arquivo."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "document_id": {
                        "type": "string",
                        "description": "ID do documento no banco vetorial.",
                    },
                    "source_file": {
                        "type": "string",
                        "description": "Nome do arquivo fonte para remover todos os chunks associados.",
                    },
                },
            },
        ),
    ]


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    """Roteia a chamada para a implementação correta da tool."""
    try:
        if name == "search_memory":
            return await _handle_search_memory(arguments)
        elif name == "scan_local_metadata":
            return await _handle_scan_local_metadata(arguments)
        elif name == "index_file":
            return await _handle_index_file(arguments)
        elif name == "vault_status":
            return await _handle_vault_status(arguments)
        elif name == "delete_memory":
            return await _handle_delete_memory(arguments)
        else:
            return [TextContent(type="text", text=f"Tool desconhecida: {name}")]
    except Exception as e:
        logger.error(f"Erro ao executar tool '{name}': {e}", exc_info=True)
        return [TextContent(type="text", text=f"Erro interno no Mnemos: {str(e)}")]


# ---------------------------------------------------------------------------
# Implementação das Tools
# ---------------------------------------------------------------------------


async def _handle_search_memory(args: dict) -> list[TextContent]:
    """Estágio 1: Busca semântica no banco vetorial."""
    query = str(args.get("query", "")).strip()
    limit = int(args.get("limit", 5))

    if not query:
        return [TextContent(type="text", text=json.dumps({"error": "Query vazia."}))]

    collection = _get_collection()
    if collection.count() == 0:
        return [TextContent(type="text", text=json.dumps({
            "hits": [],
            "total_documents": 0,
            "message": "O cofre está vazio. Nenhum documento foi indexado ainda.",
        }))]

    results = collection.query(
        query_texts=[query],
        n_results=min(limit, MAX_RESULTS),
        include=["documents", "metadatas", "distances"],
    )

    hits = []
    if results and results.get("documents"):
        for i, doc in enumerate(results["documents"][0]):
            metadata = results["metadatas"][0][i] if results.get("metadatas") else {}
            distance = results["distances"][0][i] if results.get("distances") else None
            hits.append({
                "text": doc,
                "source": metadata.get("source", "unknown"),
                "chunk_index": metadata.get("chunk_index", 0),
                "relevance": round(1.0 - (distance or 0.0), 4),
            })

    response = {
        "hits": hits,
        "total_documents": collection.count(),
        "message": f"Encontrados {len(hits)} fragmentos relevantes." if hits else "Nenhum resultado encontrado no cofre.",
    }

    return [TextContent(type="text", text=json.dumps(response, ensure_ascii=False))]


async def _handle_scan_local_metadata(args: dict) -> list[TextContent]:
    """Estágio 2: Varredura leve de metadados nos diretórios autorizados."""
    keywords = args.get("keywords", [])
    extensions = args.get("extensions", [])

    if not keywords:
        return [TextContent(type="text", text=json.dumps({"error": "Nenhuma keyword fornecida."}))]

    # Normaliza keywords e extensões
    keywords_lower = [kw.lower() for kw in keywords]
    extensions_lower = [ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in extensions]

    found_files = []
    scan_base = Path(SCAN_VOLUMES_BASE)

    if not scan_base.exists():
        return [TextContent(type="text", text=json.dumps({
            "results": [],
            "scanned_path": str(scan_base),
            "message": "Nenhum diretório de scan autorizado está montado.",
        }))]

    # Varredura com profundidade limitada
    def scan_dir(directory: Path, depth: int = 0):
        if depth > MAX_SCAN_DEPTH:
            return
        try:
            for entry in directory.iterdir():
                if entry.is_file():
                    name_lower = entry.name.lower()
                    # Filtra por extensão se especificada
                    if extensions_lower and entry.suffix.lower() not in extensions_lower:
                        continue
                    # Match por keyword no nome do arquivo
                    if any(kw in name_lower for kw in keywords_lower):
                        found_files.append({
                            "name": entry.name,
                            "path": str(entry),
                            "size_bytes": entry.stat().st_size,
                            "extension": entry.suffix,
                        })
                elif entry.is_dir() and not entry.name.startswith("."):
                    scan_dir(entry, depth + 1)
        except PermissionError:
            pass  # Silenciosamente ignora diretórios sem permissão

    scan_dir(scan_base)

    response = {
        "results": found_files[:MAX_RESULTS],
        "total_found": len(found_files),
        "scanned_path": str(scan_base),
        "message": f"Encontrados {len(found_files)} arquivo(s) correspondentes." if found_files else "Nenhum arquivo encontrado nos diretórios autorizados.",
    }

    return [TextContent(type="text", text=json.dumps(response, ensure_ascii=False))]


async def _handle_index_file(args: dict) -> list[TextContent]:
    """Estágio 3: Indexação de arquivo no banco vetorial."""
    file_path = str(args.get("file_path", "")).strip()
    tags = args.get("tags", [])

    if not file_path:
        return [TextContent(type="text", text=json.dumps({"error": "Caminho do arquivo não especificado."}))]

    fp = Path(file_path)
    if not fp.exists():
        return [TextContent(type="text", text=json.dumps({"error": f"Arquivo não encontrado: {file_path}"}))]

    # Extrai texto
    text = _extract_text(file_path)
    if not text or not text.strip():
        return [TextContent(type="text", text=json.dumps({
            "error": f"Não foi possível extrair texto do arquivo: {fp.name}",
            "extension": fp.suffix,
        }))]

    # Divide em chunks
    chunks = _chunk_text(text)
    if not chunks:
        return [TextContent(type="text", text=json.dumps({"error": "Nenhum chunk de texto gerado."}))]

    # Indexa no ChromaDB
    collection = _get_collection()

    ids = [f"{fp.stem}__chunk_{i}" for i in range(len(chunks))]
    metadatas = [{
        "source": fp.name,
        "source_path": file_path,
        "chunk_index": i,
        "total_chunks": len(chunks),
        "tags": ",".join(tags) if tags else "",
        "extension": fp.suffix,
    } for i in range(len(chunks))]

    # Upsert para permitir re-indexação
    collection.upsert(
        ids=ids,
        documents=chunks,
        metadatas=metadatas,
    )

    logger.info(f"Arquivo indexado: {fp.name} ({len(chunks)} chunks)")

    response = {
        "status": "success",
        "file_name": fp.name,
        "chunks_indexed": len(chunks),
        "total_vault_documents": collection.count(),
        "message": f"'{fp.name}' indexado com sucesso ({len(chunks)} fragmentos).",
    }

    return [TextContent(type="text", text=json.dumps(response, ensure_ascii=False))]


async def _handle_vault_status(args: dict) -> list[TextContent]:
    """Retorna estatísticas do cofre de memória."""
    collection = _get_collection()

    # Calcula espaço em disco do DB
    db_path = Path(CHROMA_DB_DIR)
    db_size = sum(f.stat().st_size for f in db_path.rglob("*") if f.is_file()) if db_path.exists() else 0

    # Verifica volumes montados
    scan_base = Path(SCAN_VOLUMES_BASE)
    mounted_volumes = []
    if scan_base.exists():
        mounted_volumes = [d.name for d in scan_base.iterdir() if d.is_dir()]

    response = {
        "total_documents": collection.count(),
        "db_size_mb": round(db_size / (1024 * 1024), 2),
        "db_path": str(db_path),
        "embedding_model": EMBEDDING_MODEL,
        "mounted_scan_volumes": mounted_volumes,
        "vault_dir": VAULT_DIR,
        "max_scan_depth": MAX_SCAN_DEPTH,
    }

    return [TextContent(type="text", text=json.dumps(response, ensure_ascii=False))]


async def _handle_delete_memory(args: dict) -> list[TextContent]:
    """Remove documentos do banco vetorial."""
    document_id = str(args.get("document_id", "")).strip()
    source_file = str(args.get("source_file", "")).strip()

    if not document_id and not source_file:
        return [TextContent(type="text", text=json.dumps({"error": "Especifique document_id ou source_file."}))]

    collection = _get_collection()

    if document_id:
        try:
            collection.delete(ids=[document_id])
            return [TextContent(type="text", text=json.dumps({
                "status": "success",
                "deleted_id": document_id,
                "message": f"Documento '{document_id}' removido do cofre.",
            }))]
        except Exception as e:
            return [TextContent(type="text", text=json.dumps({"error": str(e)}))]

    if source_file:
        # Busca todos os chunks desse arquivo fonte
        results = collection.get(
            where={"source": source_file},
            include=["metadatas"],
        )
        if results and results.get("ids"):
            collection.delete(ids=results["ids"])
            return [TextContent(type="text", text=json.dumps({
                "status": "success",
                "source_file": source_file,
                "chunks_deleted": len(results["ids"]),
                "message": f"Todos os {len(results['ids'])} chunks de '{source_file}' foram removidos.",
            }))]
        else:
            return [TextContent(type="text", text=json.dumps({
                "status": "not_found",
                "source_file": source_file,
                "message": f"Nenhum chunk encontrado para o arquivo '{source_file}'.",
            }))]


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

async def main():
    """Inicializa o servidor MCP via stdin/stdout."""
    logger.info("Iniciando Mnemos Cognitive Engine (MCP Server)...")
    logger.info(f"ChromaDB dir: {CHROMA_DB_DIR}")
    logger.info(f"Scan volumes: {SCAN_VOLUMES_BASE}")
    logger.info(f"Embedding model: {EMBEDDING_MODEL}")

    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            server.create_initialization_options(),
        )


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
