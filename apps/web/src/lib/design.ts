// Размеры из docs/design/DESIGN_SYSTEM.md §4 (в пикселях).
export const DESIGN = {
  // Оболочка
  sidebarCollapsed: 72, // боковое меню свёрнуто
  sidebarExpanded: 238, // раскрывается поверх контента при наведении
  guestHeaderHeight: 60, // верхняя панель гостя
  mobileBreakpoint: 768, // ниже — мобильная оболочка

  // Лента
  feedColumn: 630,
  postCard: 470,
  postMedia: 468,
  recommendationsColumn: 319, // правая колонка на широком экране
  storyAvatar: 74,
  storyRing: 89,
  storyStep: 104,

  // Профиль
  profileContainer: 935,
  profileAvatar: 150,
  profileStoryRing: 165,
  highlightCircle: 77,
  highlightRing: 92,
  highlightStep: 132,
  profileTabsHeight: 44,
  gridGap: 1, // промежуток сетки плиток

  // Интересное и поиск
  exploreGrid: 840,
  searchWidth: 470,
  searchHeight: 40,

  // Модальные окна
  modalHeaderHeight: 42,
  primaryButtonHeight: 32,
} as const;
