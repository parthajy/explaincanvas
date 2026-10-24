export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <span className="flex gap-1.5">
        <i className="dot h-2 w-2 rounded-full bg-primary" />
        <i className="dot h-2 w-2 rounded-full bg-primary" />
        <i className="dot h-2 w-2 rounded-full bg-primary" />
      </span>
    </div>
  );
}
