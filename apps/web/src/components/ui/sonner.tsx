'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';

// Обёртка shadcn без next-themes: цвета — токен --toast (DESIGN_SYSTEM §2.3), одинаковый в обеих темах.
const Toaster = (props: ToasterProps) => (
  <Sonner
    className="toaster group"
    style={
      {
        '--normal-bg': 'var(--toast)',
        '--normal-text': 'var(--toast-foreground)',
        '--normal-border': 'var(--toast)',
      } as React.CSSProperties
    }
    {...props}
  />
);

export { Toaster };
