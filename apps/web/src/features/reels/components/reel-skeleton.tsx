// Скелетон ролика 9:16 на время загрузки.
export function ReelSkeleton() {
  return (
    <div className="flex h-full items-end justify-center md:py-2" aria-busy="true">
      <div className="aspect-[9/16] h-full max-w-full animate-pulse bg-background-secondary md:rounded-lg" />
    </div>
  );
}
