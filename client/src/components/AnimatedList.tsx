import { motion, useInView } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import "./AnimatedList.css";

type ScrollListFrameProps = {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  showGradients?: boolean;
  displayScrollbar?: boolean;
};

type AnimatedListProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyForItem: (item: T, index: number) => string | number;
  onItemSelect?: (item: T, index: number) => void;
  className?: string;
  viewportClassName?: string;
  itemClassName?: string;
  showGradients?: boolean;
  displayScrollbar?: boolean;
  enableArrowNavigation?: boolean;
  initialSelectedIndex?: number;
  activeIndex?: number;
};

export function ScrollListFrame({
  children,
  className = "",
  viewportClassName = "max-h-72",
  showGradients = true,
  displayScrollbar = true
}: ScrollListFrameProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [topOpacity, setTopOpacity] = useState(0);
  const [bottomOpacity, setBottomOpacity] = useState(0);

  function updateGradients() {
    const target = viewportRef.current;
    if (!target) return;
    const bottomDistance = target.scrollHeight - (target.scrollTop + target.clientHeight);
    setTopOpacity(Math.min(target.scrollTop / 48, 1));
    setBottomOpacity(target.scrollHeight <= target.clientHeight ? 0 : Math.min(bottomDistance / 48, 1));
  }

  useEffect(() => {
    updateGradients();
  }, [children]);

  return (
    <div className={["scroll-list-container", className].join(" ")}>
      <div
        ref={viewportRef}
        onScroll={updateGradients}
        className={[
          "scroll-list",
          "scroll-smooth overflow-y-auto pr-2",
          "motion-safe:[scroll-behavior:smooth]",
          "[&::-webkit-scrollbar]:w-2",
          "[&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-cloud",
          "[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-steel",
          !displayScrollbar ? "[&::-webkit-scrollbar]:hidden" : "",
          viewportClassName
        ].join(" ")}
        style={{ scrollbarWidth: displayScrollbar ? "thin" : "none" }}
      >
        {children}
      </div>
      {showGradients ? (
        <>
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent transition-opacity duration-200"
            style={{ opacity: topOpacity }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent transition-opacity duration-200"
            style={{ opacity: bottomOpacity }}
          />
        </>
      ) : null}
    </div>
  );
}

export function AnimatedList<T>({
  items,
  renderItem,
  keyForItem,
  onItemSelect,
  className = "",
  viewportClassName = "max-h-72",
  itemClassName = "",
  showGradients = true,
  displayScrollbar = true,
  enableArrowNavigation = true,
  initialSelectedIndex = -1,
  activeIndex
}: AnimatedListProps<T>) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex);
  const [keyboardNav, setKeyboardNav] = useState(false);
  const visibleSelectedIndex = activeIndex ?? selectedIndex;

  const handleSelect = useCallback(
    (item: T, index: number) => {
      setSelectedIndex(index);
      onItemSelect?.(item, index);
    },
    [onItemSelect]
  );

  useEffect(() => {
    if (!enableArrowNavigation) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (!listRef.current?.contains(event.target as Node | null)) return;
      if (event.key === "ArrowDown" || (event.key === "Tab" && !event.shiftKey)) {
        event.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((previous) => Math.min(previous + 1, items.length - 1));
      } else if (event.key === "ArrowUp" || (event.key === "Tab" && event.shiftKey)) {
        event.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((previous) => Math.max(previous - 1, 0));
      } else if (event.key === "Enter" && selectedIndex >= 0 && selectedIndex < items.length) {
        event.preventDefault();
        handleSelect(items[selectedIndex], selectedIndex);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableArrowNavigation, handleSelect, items, selectedIndex]);

  useEffect(() => {
    if (!keyboardNav || visibleSelectedIndex < 0 || !listRef.current?.parentElement) return;
    const container = listRef.current.parentElement;
    const selectedItem = listRef.current.querySelector(`[data-index="${visibleSelectedIndex}"]`) as HTMLElement | null;
    if (selectedItem) {
      const extraMargin = 50;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const itemTop = selectedItem.offsetTop;
      const itemBottom = itemTop + selectedItem.offsetHeight;
      if (itemTop < containerScrollTop + extraMargin) {
        container.scrollTo({ top: itemTop - extraMargin, behavior: "smooth" });
      } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
        container.scrollTo({ top: itemBottom - containerHeight + extraMargin, behavior: "smooth" });
      }
    }
    setKeyboardNav(false);
  }, [keyboardNav, visibleSelectedIndex]);

  useEffect(() => {
    if (activeIndex === undefined || activeIndex < 0 || !listRef.current?.parentElement) return;
    const container = listRef.current.parentElement;
    const selectedItem = listRef.current.querySelector(`[data-index="${activeIndex}"]`) as HTMLElement | null;
    if (!selectedItem) return;
    const extraMargin = 50;
    const containerScrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const itemTop = selectedItem.offsetTop;
    const itemBottom = itemTop + selectedItem.offsetHeight;
    if (itemTop < containerScrollTop + extraMargin) {
      container.scrollTo({ top: itemTop - extraMargin, behavior: "smooth" });
    } else if (itemBottom > containerScrollTop + containerHeight - extraMargin) {
      container.scrollTo({ top: itemBottom - containerHeight + extraMargin, behavior: "smooth" });
    }
  }, [activeIndex, items.length]);

  return (
    <ScrollListFrame
      className={className}
      viewportClassName={viewportClassName}
      showGradients={showGradients}
      displayScrollbar={displayScrollbar}
    >
      <div ref={listRef} className="space-y-3 py-1">
        {items.map((item, index) => (
          <AnimatedItem
            key={keyForItem(item, index)}
            index={index}
            className={itemClassName}
            selected={visibleSelectedIndex === index}
            onMouseEnter={() => setSelectedIndex(index)}
            onClick={() => handleSelect(item, index)}
          >
            {renderItem(item, index)}
          </AnimatedItem>
        ))}
      </div>
    </ScrollListFrame>
  );
}

function AnimatedItem({
  children,
  index,
  className,
  selected,
  onMouseEnter,
  onClick
}: {
  children: ReactNode;
  index: number;
  className: string;
  selected: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { amount: 0.5, once: false });

  return (
    <motion.div
      ref={ref}
      data-index={index}
      className={["animated-list-item", selected ? "selected" : "", className].join(" ")}
      initial={{ scale: 0.96, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.96, opacity: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}
