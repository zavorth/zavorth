"use client";

import type { ControlPageClientModel } from "./controlPageClient.types";
import { CommandCenterControlShell } from "./command-center/components";

type ControlPageClientViewProps = {
  model: ControlPageClientModel;
};

export function ControlPageClientView({ model }: ControlPageClientViewProps) {
  return <CommandCenterControlShell model={model} />;
}
