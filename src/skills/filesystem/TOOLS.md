# Filesystem Skill

Ferramentas para manipulação de arquivos e diretórios locais na máquina host.

## Tools Disponíveis

### `read_file`
Lê o conteúdo de um arquivo de texto. Aceita caminhos absolutos ou relativos.
- Limite: 2MB por arquivo, truncado em 15k caracteres
- Uso: Quando o usuário pedir para ver, abrir ou ler um arquivo

### `create_file`
Cria um novo arquivo com conteúdo especificado.
- Segurança: Arquivos são criados apenas dentro da pasta `output/`
- Uso: Quando o usuário pedir para gerar, escrever ou salvar um arquivo

### `list_directory`
Lista o conteúdo de um diretório (arquivos e subpastas).
- Uso: Quando o usuário pedir para ver o que tem numa pasta
- Se nenhum caminho for passado, lista o diretório de trabalho atual

## Quando NÃO usar
- Para executar scripts → use a skill `execution`
- Para buscar informações na internet → use a skill `information`
