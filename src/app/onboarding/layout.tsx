export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[url('/auth-bg.svg')] bg-cover bg-center"
      />
      <div className="relative">{children}</div>
    </div>
  );
}
