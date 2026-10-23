'use client';

// Свободные варианты имени, если выбранное занято (до 3 штук).
export function UserNameSuggestions({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (name: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-12">
      <span className="text-muted-foreground">Попробуйте:</span>
      {suggestions.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => onPick(name)}
          className="rounded-full border border-border px-2 py-1 text-foreground outline-none hover:bg-hover-overlay focus-visible:ring-2 focus-visible:ring-ring"
        >
          {name}
        </button>
      ))}
    </div>
  );
}
