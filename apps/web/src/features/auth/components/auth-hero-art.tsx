import { Heart, Send, Star } from 'lucide-react';

// Своя иллюстрация для страницы входа (композиция как у Instagram: «история» в телефоне,
// карточки по бокам, реакции). Нарисована из фигур и градиентов — без чужих фотографий.
// Цвета — декоративные значения этой картинки, а не токены интерфейса.

function Landscape({ id, sky, hill }: { id: string; sky: [string, string]; hill: string }) {
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

export function AuthHeroArt() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-[530px] w-[460px]">
      {/* карточка слева */}
      <div className="absolute top-[150px] left-[48px] h-[290px] w-[150px] -rotate-[8deg] overflow-hidden rounded-[22px] shadow-(--shadow-strong)">
        <Landscape id="hero-left" sky={['#7ad7f0', '#2f80ed']} hill="#1b5e9e" />
      </div>
      {/* карточка справа */}
      <div className="absolute top-[150px] right-[48px] h-[270px] w-[140px] rotate-[8deg] overflow-hidden rounded-[22px] shadow-(--shadow-strong)">
        <Landscape id="hero-right" sky={['#c6f6b6', '#38b48b']} hill="#1d7a55" />
      </div>
      {/* телефон с историей */}
      <div className="absolute top-[70px] left-1/2 h-[410px] w-[230px] -translate-x-1/2 overflow-hidden rounded-[30px] border-[5px] border-white shadow-(--shadow-strong)">
        <Landscape id="hero-main" sky={['#ffb36b', '#e1306c']} hill="#7b2a83" />
        <div className="absolute inset-x-3 top-3 flex gap-1">
          <span className="h-[3px] flex-1 rounded-full bg-white" />
          <span className="h-[3px] flex-1 rounded-full bg-white/50" />
          <span className="h-[3px] flex-1 rounded-full bg-white/50" />
        </div>
        <div className="absolute top-6 left-3 flex items-center gap-2">
          <span className="size-8 rounded-full border-2 border-white bg-(image:--story-ring)" />
          <span className="h-2 w-16 rounded-full bg-white/80" />
        </div>
        <div className="absolute inset-x-3 bottom-4 flex items-center gap-3">
          <span className="h-9 flex-1 rounded-full border border-white/90" />
          <Heart className="size-6 text-white" />
          <Send className="size-6 text-white" />
        </div>
      </div>
      {/* реакции */}
      <div className="absolute top-[40px] left-[70px] flex items-center gap-1 rounded-full bg-white px-3 py-2 text-20 shadow-(--shadow-strong)">
        <span>😍</span>
        <span>😂</span>
        <span>🔥</span>
      </div>
      {/* сердце */}
      <div className="absolute top-[300px] left-[22px] flex size-16 items-center justify-center rounded-full bg-(image:--auth-gradient) shadow-(--shadow-strong)">
        <Heart className="size-8 fill-white text-white" />
      </div>
      {/* «Близкие друзья» */}
      <div className="absolute top-[170px] right-[22px] flex size-12 items-center justify-center rounded-full bg-(--close-friends) shadow-(--shadow-strong)">
        <Star className="size-6 fill-white text-white" />
      </div>
      {/* аватар в кольце истории */}
      <div className="absolute right-[40px] bottom-[60px] size-20 rounded-full bg-(image:--story-ring) p-[3px] shadow-(--shadow-strong)">
        <div className="size-full rounded-full border-[3px] border-white bg-(image:--auth-gradient)" />
      </div>
    </div>
  );
}
