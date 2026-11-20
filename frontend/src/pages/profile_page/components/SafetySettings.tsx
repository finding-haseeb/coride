import { useEffect, useState } from "react";
import { BadgeCheck, Ban, Loader2, Mail, Phone, Plus, Repeat, Save, Trash2, UserRound } from "lucide-react";
import { api, avatarFor, errorMessage } from "../../../lib/api";
import { STATIONS_MAP } from "../../../utils/stationsMap";
import { DAY_NAMES, formatMinutes } from "../../../utils/metroInfo";

interface Contact {
  name: string;
  phone: string;
}

interface RecurringTrip {
  id: string;
  days: number[];
  departureMinutes: number;
  startStation: number;
  endStation: number;
  active: boolean;
}

interface BlockRow {
  id: string;
  blocked: { id: string; name: string; username: string; profile_image?: string | null };
}

interface OwnProfile {
  email: string;
  emailVerified: boolean;
  gender: string | null;
  birthYear: number | null;
  emergencyContacts: Contact[] | null;
  interests: string[];
}

const INTEREST_OPTIONS = [
  "music", "cricket", "football", "movies", "books", "tech", "startups", "gaming", "fitness", "yoga",
  "food", "travel", "photography", "art", "anime", "podcasts", "coding", "fashion", "upsc", "college",
];

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass-panel rounded-2xl bg-background/40 p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

const input = "h-10 rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary";

/** Owner-only settings: verification, filter details, SOS contacts, weekly trips, blocks. */
export default function SafetySettings() {
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [recurring, setRecurring] = useState<RecurringTrip[]>([]);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [verifyLink, setVerifyLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api.get("/auth/profile").then((r) => {
      const p: OwnProfile = r.data.data;
      setProfile(p);
      setGender(p.gender ?? "");
      setBirthYear(p.birthYear ? String(p.birthYear) : "");
      setContacts(Array.isArray(p.emergencyContacts) ? p.emergencyContacts : []);
      setInterests(p.interests ?? []);
    });
    api.get("/recurring-trips").then((r) => setRecurring(r.data.data)).catch(() => undefined);
    api.get("/safety/blocks").then((r) => setBlocks(r.data.data)).catch(() => undefined);
  }, []);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setMessage(null);
    try {
      const text = await fn();
      if (text) setMessage({ ok: true, text });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  };

  const sendVerification = () =>
    run("verify", async () => {
      const r = await api.post("/auth/send-verification");
      setVerifyLink(r.data.data?.link ?? null);
      return r.data.message;
    });

  const saveDetails = () =>
    run("details", async () => {
      const cleaned = contacts.filter((c) => c.name.trim() || c.phone.trim());
      await api.put("/auth/profile", {
        gender: gender || null,
        birthYear: birthYear ? Number(birthYear) : null,
        emergencyContacts: cleaned,
        interests,
      });
      setContacts(cleaned);
      return "Saved";
    });

  const toggleRecurring = (t: RecurringTrip) =>
    run(`r-${t.id}`, async () => {
      const r = await api.put(`/recurring-trips/${t.id}`, { active: !t.active });
      setRecurring((list) => list.map((x) => (x.id === t.id ? r.data.data : x)));
    });

  const deleteRecurring = (t: RecurringTrip) =>
    run(`r-${t.id}`, async () => {
      await api.delete(`/recurring-trips/${t.id}`);
      setRecurring((list) => list.filter((x) => x.id !== t.id));
    });

  const unblock = (b: BlockRow) =>
    run(`b-${b.id}`, async () => {
      await api.delete(`/safety/block/${b.blocked.id}`);
      setBlocks((list) => list.filter((x) => x.id !== b.id));
      return `Unblocked ${b.blocked.name}`;
    });

  if (!profile) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {message && (
        <p
          role="status"
          className={`rounded-xl px-4 py-2.5 text-sm lg:col-span-2 ${
            message.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600"
          }`}
        >
          {message.text}
        </p>
      )}

      <Section title="Email verification" icon={<Mail className="size-4" />}>
        {profile.emailVerified ? (
          <p className="flex items-center gap-2 text-sm text-foreground/70">
            <BadgeCheck className="size-5 text-sky-500" /> {profile.email} is verified.
          </p>
        ) : (
          <>
            <p className="text-sm text-foreground/60">
              Verified riders get a blue badge and show up for people who filter for verified co-riders.
            </p>
            <button
              onClick={sendVerification}
              disabled={busy === "verify"}
              className="mt-3 flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy === "verify" && <Loader2 className="size-4 animate-spin" />} Send verification link
            </button>
            {verifyLink && (
              <p className="mt-3 break-all rounded-xl border border-dashed border-border p-3 text-xs text-foreground/60">
                No mail server is set up in this dev setup, so open the link here:{" "}
                <a href={verifyLink} className="text-primary underline">
                  {verifyLink}
                </a>
              </p>
            )}
          </>
        )}
      </Section>

      <Section title="About you (for co-rider filters)" icon={<UserRound className="size-4" />}>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-foreground/55">
            Gender
            <select value={gender} onChange={(e) => setGender(e.target.value)} className={input}>
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-foreground/55">
            Birth year
            <input
              inputMode="numeric"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="e.g. 1999"
              className={input}
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-foreground/45">
          Only used for “women only” and age filters. Your exact birth year is not shown on your profile.
        </p>
        <p className="mt-4 text-xs text-foreground/55">Interests (up to 8) — used to rank co-riders and suggest a first message</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {INTEREST_OPTIONS.map((i) => {
            const on = interests.includes(i);
            return (
              <button
                key={i}
                onClick={() => setInterests((l) => (on ? l.filter((x) => x !== i) : l.length < 8 ? [...l, i] : l))}
                aria-pressed={on}
                className={`rounded-full px-2.5 py-1 text-xs transition ${on ? "bg-primary text-primary-foreground" : "border border-border text-foreground/65 hover:bg-foreground/5"}`}
              >
                {i}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-foreground/45">Saved with the button under emergency contacts.</p>
      </Section>

      <Section title="Emergency contacts (for SOS)" icon={<Phone className="size-4" />}>
        <div className="flex flex-col gap-2">
          {contacts.map((c, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={c.name}
                onChange={(e) => setContacts((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                placeholder="Name"
                maxLength={60}
                className={`${input} min-w-0 flex-1`}
              />
              <input
                value={c.phone}
                onChange={(e) => setContacts((l) => l.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))}
                placeholder="+91 98xxxxxxxx"
                inputMode="tel"
                className={`${input} min-w-0 flex-1`}
              />
              <button
                onClick={() => setContacts((l) => l.filter((_, j) => j !== i))}
                className="grid size-10 shrink-0 place-items-center rounded-xl text-foreground/40 hover:bg-rose-500/10 hover:text-rose-600"
                aria-label="Remove contact"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
          {contacts.length < 3 && (
            <button
              onClick={() => setContacts((l) => [...l, { name: "", phone: "" }])}
              className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-sm text-foreground/60 hover:bg-foreground/5"
            >
              <Plus className="size-4" /> Add contact
            </button>
          )}
        </div>
        <button
          onClick={saveDetails}
          disabled={busy === "details"}
          className="mt-4 flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy === "details" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save details
        </button>
      </Section>

      <Section title="Weekly trips" icon={<Repeat className="size-4" />}>
        {recurring.length === 0 ? (
          <p className="text-sm text-foreground/55">
            None yet. On the map, tick “Repeat every week” when saving a trip.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recurring.map((t) => (
              <li key={t.id} className={`flex items-center gap-3 rounded-xl border border-border p-3 ${t.active ? "" : "opacity-55"}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {STATIONS_MAP[t.startStation] ?? "?"} → {STATIONS_MAP[t.endStation] ?? "?"}
                  </p>
                  <p className="text-xs text-foreground/50">
                    {t.days.map((d) => DAY_NAMES[d]).join(", ")} · {formatMinutes(t.departureMinutes)}
                  </p>
                </div>
                <button
                  onClick={() => toggleRecurring(t)}
                  disabled={busy === `r-${t.id}`}
                  className="rounded-full border border-border px-3 py-1 text-xs text-foreground/70 hover:bg-foreground/5"
                >
                  {t.active ? "Pause" : "Resume"}
                </button>
                <button
                  onClick={() => deleteRecurring(t)}
                  disabled={busy === `r-${t.id}`}
                  className="grid size-8 place-items-center rounded-full text-foreground/40 hover:bg-rose-500/10 hover:text-rose-600"
                  aria-label="Delete weekly trip"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Blocked people" icon={<Ban className="size-4" />}>
        {blocks.length === 0 ? (
          <p className="text-sm text-foreground/55">You haven't blocked anyone.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-3">
                <img src={avatarFor(b.blocked)} alt="" className="size-9 rounded-full object-cover" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{b.blocked.name}</span>
                <button
                  onClick={() => unblock(b)}
                  disabled={busy === `b-${b.id}`}
                  className="rounded-full border border-border px-3 py-1 text-xs text-foreground/70 hover:bg-foreground/5"
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
