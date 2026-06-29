import { useCallback, memo } from 'react';
import { IconArrowDown } from '@tabler/icons-react';

interface ScrollToBottomProps {
  containerRef: React.RefObject<HTMLElement | null>;
  visible: boolean;
}

export const ScrollToBottomButton = memo(function ScrollToBottomButton({
  containerRef,
  visible,
}: ScrollToBottomProps) {
  const scrollToBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: 'smooth',
    });
  }, [containerRef]);

  return (
    <button
      className={`zvd-scroll-bottom${visible ? '' : ' zvd-scroll-bottom--hidden'}`}
      onClick={scrollToBottom}
      type="button"
      aria-label="Rolar para o final"
      title="Rolar para o final"
    >
      <IconArrowDown size={18} stroke={2} />
    </button>
  );
});
