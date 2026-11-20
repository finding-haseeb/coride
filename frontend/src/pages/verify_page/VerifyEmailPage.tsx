import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck, Loader2, XCircle } from "lucide-react";
import { api, errorMessage } from "../../lib/api";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState<"loading" | "done" | "error">("loading");
  const [message, setMessage] = useState("");
  const sent = useRef(false);

  useEffect(() => {
    // StrictMode runs effects twice; the token only works once.
    if (sent.current) return;
    sent.current = true;
    api
      .post("/auth/verify-email", { token: params.get("token") })
      .then(() => setState("done"))
      .catch((err) => {
        setMessage(errorMessage(err, "Verification failed"));
        setState("error");
      });
  }, [params]);

  return (
    <div className="grid min-h-full place-items-center px-4 py-16">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-8 text-center shadow-xl">
        {state === "loading" && <Loader2 className="mx-auto size-10 animate-spin text-primary" />}
        {state === "done" && (
          <>
            <BadgeCheck className="mx-auto size-12 text-sky-500" />
            <h1 className="mt-4 text-xl font-semibold text-foreground">Email verified</h1>
            <p className="mt-2 text-sm text-foreground/60">Your profile now shows a verified badge.</p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="mx-auto size-12 text-rose-500" />
            <h1 className="mt-4 text-xl font-semibold text-foreground">Link didn't work</h1>
            <p className="mt-2 text-sm text-foreground/60">{message}. Send a new link from your profile.</p>
          </>
        )}
        <Link
          to="/profile"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Go to profile
        </Link>
      </div>
    </div>
  );
}
