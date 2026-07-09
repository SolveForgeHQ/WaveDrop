export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-block border-2 border-[#27272e] border-t-[#7c5cfc] rounded-full animate-spin"
    />
  );
}

export function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={28} />
    </div>
  );
}
