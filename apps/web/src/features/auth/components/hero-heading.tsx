'use client';

import { useLayoutEffect, useRef, useState } from 'react';

const LINE = 64.8; // высота строки слогана у instagram.com
const MAX_LINES = 4;

/**
 * Слоган и картинка страницы входа. У instagram.com слоган стоит по центру блока высотой в 4 строки,
 * а картинка начинается сразу под текстом: если слоган уместился в 3 строки (≈1366 px), он опускается
 * на полстроки, а картинка поднимается. Повторяем это, измеряя число строк.
 * Ширина блока подобрана так, чтобы переносы строк совпадали с instagram.com на 1100–1903 px;
 * translate-x-5 — у Instagram текст смещён на 20 px вправо от центра колонки.
 */
export function HeroHeading({
  children,
  picture,
}: {
  children: React.ReactNode;
  picture: React.ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [lines, setLines] = useState(MAX_LINES);

  useLayoutEffect(() => {
    const el = heading.current;
    if (!el) return;
    const measure = () => {
      if (!el.offsetHeight) return; // ещё не нарисован (или тесты без раскладки)
      setLines(Math.min(MAX_LINES, Math.round(el.offsetHeight / LINE)));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return; // старый браузер или тесты (jsdom)
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shift = ((MAX_LINES - lines) * LINE) / 2;
  return (
    <>
      <div
        className="mx-auto w-[min(calc((100%+40px)*0.76),calc(1669px-57vw),760px)] translate-x-5"
        style={{ marginTop: 79 + shift }}
      >
        <h2
          ref={heading}
          className="text-center font-hero text-[2.8vw] leading-[64.8px] font-normal text-auth-text"
        >
          {children}
        </h2>
      </div>
      <div className="-mt-[9px]">{picture}</div>
    </>
  );
}
