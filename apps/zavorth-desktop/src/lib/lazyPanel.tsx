/**
 * Lazy panel wrapper for secondary desktop surfaces.
 */
import { Suspense, type ComponentType, type ReactNode, lazy } from 'react';
import { Loader } from '../primitives/ui';
import { t } from '../i18n';

export function PanelSuspense(props: { children: ReactNode; label?: string }) {
  return (
    <Suspense
      fallback={(
        <div className="zvd-panel-loading" role="status" aria-live="polite">
          <Loader label={props.label || t('a11y.loadingPanel')} />
        </div>
      )}
    >
      {props.children}
    </Suspense>
  );
}

/** Factory for React.lazy panel modules that default-export or named-export a component. */
export function lazyNamed<TModule extends Record<string, unknown>, TKey extends keyof TModule>(
  loader: () => Promise<TModule>,
  exportName: TKey,
): TModule[TKey] extends ComponentType<infer Props>
  ? React.LazyExoticComponent<ComponentType<Props>>
  : never {
  return lazy(async () => {
    const mod = await loader();
    const Comp = mod[exportName] || mod.default;
    if (!Comp) {
      throw new Error(`Lazy panel export missing: ${String(exportName)}`);
    }
    return { default: Comp as ComponentType<unknown> };
  }) as TModule[TKey] extends ComponentType<infer Props>
    ? React.LazyExoticComponent<ComponentType<Props>>
    : never;
}
