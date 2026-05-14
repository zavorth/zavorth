# Information & Web Search Skill

Ferramentas para buscar informações na internet e obter dados temporais.

## Tools Disponíveis

### `web_search`
Pesquisa na internet via DuckDuckGo com fallbacks para Google News RSS e Bing News RSS.
- Retorna título, URL e trecho de cada resultado
- Suporta buscas em português, inglês e espanhol
- Gate de qualidade para notícias: verifica frescor e quantidade de resultados
- Uso: Quando o usuário perguntar sobre notícias, preços, clima, placares ou qualquer dado atual

### `get_datetime`
Retorna a data e hora atuais do sistema com suporte a fusos horários.
- Formato: data por extenso em português + ISO 8601
- Uso: Quando o pedido depender de data/hora atual

## Quando NÃO usar
- Para ler arquivos locais → use a skill `filesystem`
- Para executar comandos → use a skill `execution`
