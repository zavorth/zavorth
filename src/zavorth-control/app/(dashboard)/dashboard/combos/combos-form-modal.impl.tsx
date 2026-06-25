"use client";

import type { ComboFormModalProps } from "./combos-form-modal.types";
import { useComboFormModalController } from "./combos-form-modal.hooks";
import { ComboFormModalView } from "./combos-form-modal.view";

export function ComboFormModal(props: ComboFormModalProps) {
  const controller = useComboFormModalController(props);

  return <ComboFormModalView {...props} controller={controller} />;
}
