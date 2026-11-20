type AuthOverlayProps = {
  isSignUp: boolean;
  onToggle: () => void;
};

export default function AuthOverlay({ isSignUp, onToggle }: AuthOverlayProps) {
  return (
    <div
      className="absolute bottom-0 top-0 z-10 flex w-1/2 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 text-white transition-all duration-500"
      style={{ left: isSignUp ? "0" : "50%" }}
    >
      {/* Decorative metro lines */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
        viewBox="0 0 400 500"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <path d="M-20 120 C 120 120, 160 260, 420 260" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        <path d="M-20 380 C 140 380, 160 260, 420 260" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeOpacity=".6" />
        <path d="M200 -20 L 200 520" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="2 14" strokeLinecap="round" strokeOpacity=".5" />
        {[60, 140, 260, 340].map((x) => (
          <circle key={x} cx={x} cy={x < 200 ? 120 + (x - 60) * 0.6 : 260} r="7" fill="#fff" />
        ))}
      </svg>

      <div className="relative z-10 mx-auto flex w-4/5 flex-col items-center gap-6 text-center">
        <img src="/coride-logo.svg" alt="" width={56} height={56} className="rounded-2xl shadow-xl ring-4 ring-white/20" />
        <h2 className="text-4xl font-semibold tracking-tight drop-shadow-sm">
          {isSignUp ? "Already riding?" : "New to CoRide?"}
        </h2>
        <p className="max-w-xs text-[15px] leading-relaxed text-white/80">
          {isSignUp
            ? "Sign in to see who shares your metro route today."
            : "Create an account and find people on your daily Delhi Metro route."}
        </p>
        <button
          className="h-12 w-2/3 rounded-full border-2 border-white/80 font-semibold tracking-wide text-white transition hover:bg-white hover:text-indigo-700"
          onClick={onToggle}
        >
          {isSignUp ? "Sign in" : "Create account"}
        </button>
      </div>
    </div>
  );
}
