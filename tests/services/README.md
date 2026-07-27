# tests/services

This folder is a compatibility zone for facades and services that remain canonical in `src/services`.

Novos testes de dominio devem nascer no bounded context dono do comportamento:

- surface/shared command: `tests/domain/surface/`
- dashboard web: `tests/domain/surface/presentation/dashboard/`
- web app runtime: `tests/domain/surface/presentation/web-app/`
- gateway/session plane: `tests/gateway/` ou `tests/services/Gateway*` enquanto a facade antiga for o contrato publico
- Telegram: `tests/telegram/`

Not adicione aqui novas megasuites de surface, dashboard ou web app runtime. Se o teste needs instanciar `DashboardService` apenas como facade de compatibilidade, mantenthere is o file pequeno e nomeie pelo plane/route exercitado. Suites grandes devem ficar no bounded context acima.
