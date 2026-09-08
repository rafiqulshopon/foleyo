/** Shared inline error banner — announced to screen readers via role="alert". */
export function ErrorAlert({
  message,
  className = '',
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`border-l-2 border-danger bg-danger/10 px-4 py-2.5 text-sm leading-relaxed text-danger ${className}`}
    >
      {message}
    </div>
  );
}
