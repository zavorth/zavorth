import {
  GatewayCallbackRouter,
  type GatewayCallbackRouterDeps,
} from '../../../../gateways/channels/telegram/bot-gateway/GatewayCallbackRouter.js';

export type TelegramCallbackControllerDeps = GatewayCallbackRouterDeps;

export class TelegramCallbackController extends GatewayCallbackRouter {
  constructor(deps: TelegramCallbackControllerDeps) {
    super(deps);
  }
}
