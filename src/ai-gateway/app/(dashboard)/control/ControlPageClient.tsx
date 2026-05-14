"use client";

import { useControlPageClient } from "./useControlPageClient";
import { ControlPageClientView } from "./controlPageClient.view";

export default function ControlPageClient() {
  const model = useControlPageClient();
  return <ControlPageClientView model={model} />;
}
