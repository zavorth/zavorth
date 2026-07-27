# Mnemos

Mnemos is the Zavorth memory service. It exposes semantic search, metadata scanning, and file indexing tools for configured vaults.

## Storage

```text
/app/data/vault      <- configured vault directory
/app/data/vector_db  <- persistent vector database
```

## Supported Inputs

Text, code, HTML, and CSV files are read directly. Other formats require a configured extractor.

## Setup

### 1. Configure volumes

Mount each scan source as a dedicated volume.

### 2. Configure environment variables

Set the vault and database paths for the deployment.

### 3. Automatic boot

The service initializes indexes and starts serving configured tools.

## Notes

Each mounted folder is exposed inside the container as `/scan_volumes/0`, `/scan_volumes/1`, and so on. The vault folder is persistent and configurable, while the primary persistent vector memory lives in `/app/data/vector_db`.
