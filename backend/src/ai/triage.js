import { z } from "zod";
import prisma from "../config/db.js";
import { askStructured } from "./claude.js";
import { screenMessage } from "./moderation.js";

const TriageSchema = z.object({
  riskScore: z.number().int(),
  label: z.enum(["low", "medium", "high"]),
  reason: z.string(),
});

const SYSTEM = `You help the safety team of CoRide, an app where Delhi Metro commuters meet strangers to ride together.
Given a user report and the reported person's recent messages to the reporter, estimate how urgent the report is.
riskScore is 0-100: 80+ for threats, sexual harassment, stalking or scams; 40-79 for abuse or repeated unwanted contact; below 40 when the messages do not support the report.
"reason" is one short sentence for a human moderator. You only advise; a human makes the decision.`;

const labelFor = (score) => (score >= 70 ? "high" : score >= 40 ? "medium" : "low");

/** Scores a report with Claude, or with the rule-based screen. Never throws. */
export async function triageReport(reportId) {
  try {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) return;
    const [messages, priorReports] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { senderId: report.reportedId, receiverId: report.reporterId },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { message: true, createdAt: true },
      }),
      prisma.report.count({ where: { reportedId: report.reportedId, id: { not: report.id } } }),
    ]);

    const ai = await askStructured({
      system: SYSTEM,
      prompt: [
        `Reason picked by reporter: ${report.reason}`,
        `Reporter's details: ${report.details || "(none)"}`,
        `Other reports against this person: ${priorReports}`,
        `Recent messages from the reported person to the reporter (newest first):`,
        ...(messages.length ? messages.map((m) => `- ${m.message.slice(0, 500)}`) : ["(no messages)"]),
      ].join("\n"),
      schema: TriageSchema,
      maxTokens: 400,
    });

    let result;
    if (ai) {
      const score = Math.max(0, Math.min(100, ai.riskScore));
      result = { riskScore: score, riskLabel: ai.label, riskReason: `AI: ${ai.reason}`.slice(0, 300) };
    } else {
      const worst = messages.map((m) => screenMessage(m.message)).sort((a, b) => b.score - a.score)[0];
      const base = { harassment: 40, unsafe_behaviour: 45, fake_profile: 30, spam: 25, no_show: 10, other: 20 }[report.reason] ?? 20;
      const score = Math.min(100, Math.max(base, worst?.score ?? 0) + Math.min(priorReports, 4) * 10);
      result = {
        riskScore: score,
        riskLabel: labelFor(score),
        riskReason: `Rules: ${worst?.reasons.length ? worst.reasons.join(", ") : "no flagged words"}; ${priorReports} earlier report(s)`,
      };
    }
    await prisma.report.update({ where: { id: reportId }, data: result });
  } catch (error) {
    console.error("[triage] failed:", error.message);
  }
}
