import { Check, Heart, Star } from 'lucide-react';

// Своя иллюстрация для страницы входа. Композиция и размеры — как у картинки instagram.com
// (840×480, сверено 2026-10-23): «история» в телефоне по центру, две карточки за ней, реакции,
// сердце, отметка «Близкие друзья», аватар в кольце. Нарисована из фигур и градиентов — без чужих фото.
// Все размеры в cqw (доля ширины рамки), поэтому картинка целиком масштабируется с колонкой.
// Цвета — декоративные значения этой картинки, а не токены интерфейса.

function Scene({ id, sky, hill }: { id: string; sky: [string, string]; hill: string }) {
  return (
    <svg viewBox="0 0 200 360" preserveAspectRatio="xMidYMid slice" className="size-full">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="1" stopColor={sky[1]} />
        </linearGradient>
      </defs>
      <rect width="200" height="360" fill={`url(#${id})`} />
      <circle cx="140" cy="120" r="34" fill="#fff4c2" opacity="0.9" />
      <path d="M0 250 Q50 190 100 235 T200 215 V360 H0 Z" fill={hill} opacity="0.75" />
      <path d="M0 290 Q70 240 130 285 T200 275 V360 H0 Z" fill={hill} />
    </svg>
  );
}

// Положение в процентах рамки 840×480 (x, y, ширина, высота — как на картинке Instagram).
const box = (x: number, y: number, w: number, h: number) => ({
  left: `${(x / 840) * 100}%`,
  top: `${(y / 480) * 100}%`,
  width: `${(w / 840) * 100}%`,
  height: `${(h / 480) * 100}%`,
});
const px = (n: number) => `${(n / 840) * 100}cqw`; // n пикселей при ширине 840

export function AuthHeroArt() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto aspect-[840/480] w-full max-w-[840px] [container-type:inline-size]"
    >
      {/* карточка слева (за телефоном) */}
      <div
        className="absolute -rotate-[6deg] overflow-hidden shadow-(--shadow-strong)"
        style={{ ...box(222, 118, 150, 262), borderRadius: px(16) }}
      >
        <Scene id="hero-left" sky={['#7ad7f0', '#2f80ed']} hill="#1b5e9e" />
      </div>
      {/* карточка справа */}
      <div
        className="absolute rotate-[6deg] overflow-hidden shadow-(--shadow-strong)"
        style={{ ...box(462, 112, 152, 266), borderRadius: px(16) }}
      >
        <Scene id="hero-right" sky={['#c6f6b6', '#38b48b']} hill="#1d7a55" />
      </div>
      {/* телефон с историей */}
      <div
        className="absolute overflow-hidden shadow-(--shadow-strong)"
        style={{ ...box(310, 51, 213, 377), borderRadius: px(18) }}
      >
        <Scene id="hero-main" sky={['#ffb36b', '#e1306c']} hill="#7b2a83" />
        <div className="absolute flex" style={{ inset: `${px(10)} ${px(10)} auto`, gap: px(4) }}>
          <span className="flex-1 rounded-full bg-white" style={{ height: px(3) }} />
          <span className="flex-1 rounded-full bg-white/50" style={{ height: px(3) }} />
          <span className="flex-1 rounded-full bg-white/50" style={{ height: px(3) }} />
        </div>
        <div
          className="absolute flex items-center"
          style={{ left: px(14), right: px(14), bottom: px(16), gap: px(12) }}
        >
          <span
            className="flex-1 rounded-full border-2 border-white/90"
            style={{ height: px(26) }}
          />
          <Heart className="text-white" style={{ width: px(24), height: px(24) }} />
        </div>
      </div>
      {/* реакции */}
      <div
        className="absolute flex -rotate-[12deg] items-center justify-center rounded-full bg-white shadow-(--shadow-strong)"
        style={{ ...box(264, 66, 101, 47), gap: px(4), fontSize: px(20) }}
      >
        <span>🔮</span>
        <span>👀</span>
        <span>🤯</span>
      </div>
      {/* сердце */}
      <div className="absolute" style={box(196, 246, 56, 50)}>
        <Heart
          className="size-full -rotate-[12deg] fill-[#ff3040] text-[#ff3040] drop-shadow-lg"
          strokeWidth={1}
        />
      </div>
      {/* «Близкие друзья» */}
      <div
        className="absolute flex items-center justify-center rounded-full bg-[#1fcc5b] text-white shadow-(--shadow-strong)"
        style={{ ...box(589, 153, 54, 30), gap: px(2) }}
      >
        <Star className="fill-white" style={{ width: px(16), height: px(16) }} />
        <Check style={{ width: px(10), height: px(10) }} strokeWidth={3} />
      </div>
      {/* аватар в кольце истории */}
      <div
        className="absolute rounded-full bg-(image:--story-ring)"
        style={{ ...box(574, 259, 70, 67), padding: px(3) }}
      >
        <div
          className="size-full rounded-full bg-(image:--auth-gradient)"
          style={{ border: `${px(3)} solid #0c1014` }}
        />
      </div>
    </div>
  );
}
