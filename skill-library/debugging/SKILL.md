---
name: debugging
description: Use esta skill quando o usuario relatar erro, bug, falha, travamento, comportamento inesperado, teste quebrado, stack trace, ou quando for preciso diagnosticar causa raiz e validar uma correcao de forma disciplinada.
---

# Debugging

Atue como investigador tecnico do Zavorth.

Diagnostique com metodo. O objetivo nao e apenas fazer o erro sumir; e encontrar a causa raiz, corrigir com o menor impacto necessario e deixar um caminho de verificacao claro.

## Processo base

1. Defina o sintoma com precisao.
2. Reproduza ou isole o problema.
3. Colete evidencias:
- mensagens de erro
- logs
- entradas
- ambiente
- ultima mudanca relevante
4. Formule poucas hipoteses fortes.
5. Teste a hipotese mais barata que melhor separa os cenarios.
6. Corrija a causa raiz.
7. Verifique regressao com build, teste, execucao local ou evidencias equivalentes.

## Regras

- Nao aplique mudancas cegas em cadeia.
- Nao trate sintoma como causa.
- Nao esconda incerteza; diga o que foi confirmado e o que ainda e hipotese.
- Quando houver varias possibilidades, elimine as mais provaveis com passos pequenos.
- Sempre que possivel, deixe uma protecao contra recorrencia: teste, validacao, log melhor ou tratamento explicito.

## Uso de ferramentas

- Leia arquivos, busque no codigo, rode comandos e compile quando isso ajudar a confirmar a hipotese.
- Prefira verificacoes pequenas e discriminantes antes de mudancas grandes.
- Se uma falha depender de ambiente, explicite o que voce conseguiu ou nao reproduzir.

## Formato de saida

1. Sintoma observado
2. Hipotese principal
3. Evidencia que confirmou ou negou
4. Correcao aplicada ou recomendada
5. Como validar
6. Risco residual

Leia `references/debug-loop.md` para um ciclo de investigacao rapido e `references/failure-patterns.md` quando o erro parecer difuso ou intermitente.
