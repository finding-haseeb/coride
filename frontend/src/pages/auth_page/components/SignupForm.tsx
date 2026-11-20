import ImageUploader from "./ImageUploader";

type SignupFormProps = {
  name: string;
  email: string;
  password: string;
  bio?: string;
  imageUrl?: string;
  isSubmitting: boolean;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEmailChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPasswordChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBioChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onImageUpload: (file: File) => Promise<void>;
  onSubmit: () => void;
  onLoginClick: () => void;
};

export default function SignupForm({
  name,
  email,
  password,
  bio,
  imageUrl,
  isSubmitting,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onBioChange,
  onImageUpload,
  onSubmit,
  onLoginClick,
}: SignupFormProps) {
  return (
    <div className="w-1/2 flex flex-col items-center justify-center py-4 bg-background text-foreground">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Join CoRide</h2>
        <p className="mt-2 text-sm text-foreground/55">Meet people on your metro route</p>
      </div>

      <form 
        onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
        className="w-full max-w-lg space-y-3 font-body-sm"
      >
        <input
          type="text"
          name="name"
          placeholder="Full Name"
          value={name}
          onChange={onNameChange}
          className="w-full h-12 px-4 bg-background border border-border rounded-xl text-[15px] focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 text-foreground placeholder-foreground/40 transition-all"
        />

        <div className="flex w-full flex-row items-center gap-2 justify-between">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={email}
            onChange={onEmailChange}
            className="w-1/2 h-12 px-4 bg-background border border-border rounded-xl text-[15px] focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 text-foreground placeholder-foreground/40 transition-all"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={password}
            onChange={onPasswordChange}
            className="w-1/2 h-12 px-4 bg-background border border-border rounded-xl text-[15px] focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 text-foreground placeholder-foreground/40 transition-all"
          />
        </div>

        <div className="flex w-full flex-row h-24 items-center gap-2 justify-between">
          <textarea
            name="bio"
            placeholder="Tell us about yourself..."
            value={bio}
            onChange={onBioChange}
            className="w-1/2 h-full p-3 bg-background border border-border rounded-[8px] focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder-foreground/50 transition-all resize-none shadow-sm"
          />
          <div className="w-1/2 h-full">
            <ImageUploader
              imageUrl={imageUrl}
              onImageUpload={onImageUpload}
              className="h-full w-full"
            />
          </div>
        </div>

        {/* SIGN UP Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-12 mt-4 bg-primary text-primary-foreground font-button rounded-xl shadow-lg shadow-primary/25 hover:brightness-110 transition-opacity flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
          ) : (
            "Create account"
          )}
        </button>

        <p className="text-center font-body-sm mt-4 text-foreground/70">
          Already have an account?{" "}
          <span
            className="text-primary font-bold cursor-pointer hover:underline transition-colors"
            onClick={onLoginClick}
          >
            Sign in
          </span>
        </p>
      </form>
    </div>
  );
}
