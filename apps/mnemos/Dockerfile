FROM python:3.11-slim

WORKDIR /app

# Instala dependências do sistema necessárias para ChromaDB, Sentence Transformers e PDFs
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
# Install CPU-only Torch first so sentence-transformers does not pull CUDA wheels.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Diretórios internos do container
RUN mkdir -p /app/data/vector_db /app/data/vault

# Variáveis padrão (overridáveis via docker run -e)
ENV MNEMOS_CHROMA_DB_DIR=/app/data/vector_db
ENV MNEMOS_SCAN_VOLUMES=/scan_volumes
ENV MNEMOS_VAULT_DIR=/app/data/vault
ENV MNEMOS_EMBEDDING_MODEL=all-MiniLM-L6-v2
ENV MNEMOS_MAX_SCAN_DEPTH=5
ENV MNEMOS_MAX_RESULTS=10
ENV HF_HOME=/app/models/huggingface
ENV SENTENCE_TRANSFORMERS_HOME=/app/models/sentence-transformers

# Pré-download do modelo de embedding para evitar delay na primeira query
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Runtime is intentionally networkless, so model loading must stay local-only.
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

# MCP: rodar via stdio para consumo direto pelo Zavorth via child process
CMD ["python", "server.py"]
