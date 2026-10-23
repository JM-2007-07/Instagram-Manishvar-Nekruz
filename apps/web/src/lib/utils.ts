import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Наши размеры текста (text-14, text-hero… из globals.css) — это размер, а не цвет.
// Без этой настройки cn('text-primary-foreground', 'text-30') терял бы цвет.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            '10',
            '11',
            '12',
            '14',
            '15',
            '16',
            '17',
            '18',
            '20',
            '24',
            '26',
            '28',
            '30',
            'hero',
          ],
        },
      ],
      'font-family': [{ font: ['sans', 'auth', 'display', 'wordmark'] }],
    },
  },
});

// Склеивает классы и убирает конфликты Tailwind: cn('p-2', cond && 'p-4') -> 'p-4'
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
