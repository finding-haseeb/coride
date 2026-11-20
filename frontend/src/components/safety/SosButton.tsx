import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MessageSquareText, Phone, Siren, X } from "lucide-react";
import { api, errorMessage } from "../../lib/api";

interface SosResult {
  notifiedFriends: number;
  contacts: { name: string; phone: string }[];
  message: string;
  mapsUrl: string | null;
}

function getPosition(): Promise<GeolocationPosition | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000,
    }),
  );
}

const smsLink = (phone: string, body: string) => `sms:${phone}?&body=${encodeURIComponent(body)}`;

/** Red SOS button: alerts CoRide friends and prepares SMS to emergency contacts. */
export function SosButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SosResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setOpen(false);
    setResult(null);
    setError(null);
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const pos = await getPosition();
      const res = await api.post("/safety/sos", pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : {});
      setResult(res.data.data);
    } catch (err) {
      setError(errorMessage(err, "SOS could not be sent"));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`pointer-events-auto flex h-10 items-center gap-1.5 rounded-full bg-rose-600 px-3.5 text-xs font-bold tracking-wide text-white shadow-lg shadow-rose-600/30 transition hover:bg-rose-700 active:scale-95 ${className}`}
        aria-label="SOS emergency alert"
      >
        <Siren className="size-4" /> SOS
      </button>

      {open && (
        <div className="fixed inset-0 z-[4000] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center" onClick={close}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sos-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-2xl border border-rose-500/30 bg-card p-6 shadow-2xl animate-fade-in-up"
          >
            <button onClick={close} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-foreground/40 hover:bg-foreground/5" aria-label="Close">
              <X className="size-4" />
            </button>
            <div className="mb-3 grid size-12 place-items-center rounded-full bg-rose-600 text-white">
              <Siren className="size-6" />
            </div>

            {!result ? (
              <>
                <h3 id="sos-title" className="text-lg font-semibold text-foreground">Send an SOS?</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground/60">
                  Your CoRide friends get an alert with your location. Then you can text your emergency contacts in one tap.
                </p>
                {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p>}
                <button
                  onClick={send}
                  disabled={sending}
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Siren className="size-4" />}
                  {sending ? "Getting location…" : "Send SOS now"}
                </button>
              </>
            ) : (
              <>
                <h3 id="sos-title" className="text-lg font-semibold text-foreground">
                  {result.notifiedFriends > 0
                    ? `Alert sent to ${result.notifiedFriends} friend${result.notifiedFriends > 1 ? "s" : ""}`
                    : "No CoRide friends to alert"}
                </h3>
                <p className="mt-1 text-sm text-foreground/60">
                  {result.mapsUrl ? "Your location was included." : "Location was not available."} Text your contacts:
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  {result.contacts.length === 0 && (
                    <Link to="/profile/edit" onClick={close} className="rounded-xl border border-dashed border-border p-3 text-sm text-primary">
                      Add emergency contacts in your profile →
                    </Link>
                  )}
                  {result.contacts.map((c) => (
                    <a
                      key={c.phone}
                      href={smsLink(c.phone, result.message)}
                      className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm hover:bg-foreground/5"
                    >
                      <MessageSquareText className="size-4 text-rose-600" />
                      <span className="flex-1 font-medium text-foreground">Text {c.name}</span>
                      <span className="text-xs text-foreground/45">{c.phone}</span>
                    </a>
                  ))}
                </div>
              </>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href="tel:112" className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-foreground/5">
                <Phone className="size-4" /> Call 112
              </a>
              <a href="tel:155370" className="flex h-11 items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-foreground/5" title="DMRC helpline">
                <Phone className="size-4" /> DMRC 155370
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
