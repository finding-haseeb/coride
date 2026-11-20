// Rule-based message screening. Used for every chat message (fast, no network)
// and as the fallback when AI report triage is unavailable.
// NOTE: chat-gateway/src/moderation.js keeps a copy of these rules.

const ABUSE = [
  "fuck you", "f u c k", "bitch", "whore", "slut", "bastard", "motherfucker",
  "randi", "chutiya", "chutiye", "madarchod", "behenchod", "bhenchod", "bhosdike", "bhosdi", "harami",
  "gaand", "lund", "mc ", "bc ", "kamina", "kutti",
];
const THREATS = [
  "kill you", "i will kill", "rape", "maar dunga", "maar dalunga", "jaan se", "acid", "dekh lunga",
  "follow you home", "i know where you live", "ghar aa jaunga",
];
const SCAM = [
  "otp", "upi pin", "send money", "paise bhejo", "pay first", "advance payment", "lottery", "you won",
  "kyc", "double your money", "investment plan", "crypto profit", "gift card", "bank details", "cvv",
];
const SHORTENERS = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly|rb\.gy|shorturl\.at|t\.me)\/\S+/i;
const ANY_LINK = /\bhttps?:\/\/\S+/i;

const hits = (text, list) => list.filter((w) => text.includes(w));

/**
 * @returns {{ action: "allow"|"warn"|"block", score: number, reasons: string[] }}
 * score is a 0-100 risk estimate.
 */
export function screenMessage(raw) {
  const text = ` ${String(raw || "").toLowerCase()} `;
  const reasons = [];
  let score = 0;

  const threat = hits(text, THREATS);
  if (threat.length) {
    score += 90;
    reasons.push("threat");
  }
  const abuse = hits(text, ABUSE);
  if (abuse.length) {
    score += 60;
    reasons.push("abusive language");
  }
  const scam = hits(text, SCAM);
  if (scam.length) {
    score += 35 * Math.min(scam.length, 2);
    reasons.push("possible scam");
  }
  if (SHORTENERS.test(text)) {
    score += 50;
    reasons.push("shortened link");
  } else if (ANY_LINK.test(text) && scam.length) {
    score += 20;
  }

  score = Math.min(100, score);
  const action = score >= 60 ? "block" : score >= 30 ? "warn" : "allow";
  return { action, score, reasons };
}
