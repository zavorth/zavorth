# tests/services

Esta pasta e zona de compatibilidade para facades e services ainda canonicos em `src/services`.

Novos testes de dominio devem nascer no bounded context dono do comportamento:

- surface/shared command: `tests/domain/surface/`
- dashboard web: `tests/domain/surface/presentation/dashboard/`
- web app runtime: `tests/domain/surface/presentation/web-app/`
- gateway/session plane: `tests/gateway/` ou `tests/services/Gateway*` enquanto a facade antiga for o contrato publico
- Telegram: `tests/telegram/`

Nao adicione aqui novas megasuites de surface, dashboard ou web app runtime. Se o teste precisa instanciar `DashboardService` apenas como facade de compatibilidade, mantenha o arquivo pequeno e nomeie pelo plane/route exercitado. Suites grandes devem ficar no bounded context acima.
