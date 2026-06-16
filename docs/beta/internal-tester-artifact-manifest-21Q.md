# Manifesto de Artefato - Fase 21Q

> [!IMPORTANT]
> **Status de Entrega: PREPARAÇÃO LOCAL (DRY RUN)**
> - Nenhum tester recebeu este build ainda.
> - Nenhum upload público ou push remoto foi efetuado.
> - Nenhum GitHub Release ou npm publish foi criado.
> - Nenhum auto-update está ativo.
> - Este é um build candidato local estrito para fins de homologação.
> - **Tipo**: internal-only / private / candidate

## 1. Dados do Artefato
- **Nome do Artefato**: `zavorth-internal-tester-candidate-21q-2026-06-15.zip`
- **Caminho Local Relativo**: `tmp/internal-tester/zavorth-internal-tester-candidate-21q-2026-06-15.zip`
- **Tipo de Artefato**: Arquivo Compactado (ZIP) do build cliente do desktop.
- **Tamanho do Arquivo (Bytes)**: `108401`
- **Algoritmo de Hash**: SHA256
- **SHA256 Real**: `012099B2700E12EB0143D73EA68728114803CFAF0C214EF73ACE71DB10BD1E3E`
- **Commit HEAD de Origem**: `b62cbde101a8386327b66c595d8dd86766529da1`
- **Tag Base de Origem**: `zavorth-security-readiness-gate-2026-06-15`
- **Data de Geração**: `2026-06-15`

## 2. Comandos de Geração Utilizados
Para gerar o pacote localmente no HEAD final aprovado:
```bash
npm run surfaces:check
npm run runtime:check
npm --prefix apps/zavorth-desktop run build
```
Depois empacotado localmente no PowerShell:
```powershell
New-Item -ItemType Directory -Force tmp/internal-tester
Compress-Archive -Path apps/zavorth-desktop/dist/* -DestinationPath tmp/internal-tester/zavorth-internal-tester-candidate-21q-2026-06-15.zip -Force
```

## 3. Estado de Distribuição
- **Geração Local Realizada (Generated Locally)**: `yes`
- **Upload Externo Realizado (Uploaded)**: `no`
- **Release Público Criado (Public Release)**: `no`
- **Entregue para Testers (Tester Delivered)**: `no`

## 4. Instruções de Verificação
O tester ou QA auditor deve rodar localmente no terminal do PowerShell o seguinte comando para confirmar que o arquivo ZIP local bate com este manifesto:
```powershell
Get-FileHash -Path .\tmp\internal-tester\zavorth-internal-tester-candidate-21q-2026-06-15.zip -Algorithm SHA256
```

## 5. Limitações Conhecidas
- O artefato não inclui instalador assinado (.exe / .dmg / .msi) ou empacotamento completo de binários nativos de terceiros, dependendo da instalação prévia do Node.js.
- O build destina-se apenas a testes internos e privados locais.
