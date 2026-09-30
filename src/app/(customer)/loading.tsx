const SKELETON_CARDS = [1, 2, 3, 4, 5, 6];

export default function CustomerLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="h-8 w-64 animate-pulse rounded-xl bg-field-white shadow-sm" />
      <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded-lg bg-field-white shadow-sm" />
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SKELETON_CARDS.map((item) => (
          <div key={item} className="h-44 animate-pulse rounded-2xl bg-field-white shadow-sm" />
        ))}
      </div>
    </div>
  );
}
