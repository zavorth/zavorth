# Zavorth Companion Distribution

O bundle oficial do desktop companion agora e gerado por:

```powershell
npm run companion:package
```

Saida padrao:

```text
output/distribution/zavorth-companion
```

O bundle inclui:

- `index.js`
- `runtime/companion.js`
- `companion-start.ps1`
- `companion-start.cmd`
- `distribution-manifest.json`
- `README.txt`

Fluxo recomendado:

1. gerar um pairing draft via `npm run cli:fast -- nodepair ...`
2. empacotar o companion via `npm run companion:package`
3. distribuir a pasta gerada ao operador
4. iniciar pelo `companion-start.ps1`

Exemplo de bootstrap:

```powershell
companion-start.ps1 -Passcode "<nodeId:pairingCode>" -BaseUrl "http://127.0.0.1:33333"
```

Troubleshooting curto:

- se o pairing falhar, gere um draft novo no host
- se o host web mudar, ajuste `-BaseUrl`
- valide `distribution-manifest.json` quando precisar conferir integridade do bundle
