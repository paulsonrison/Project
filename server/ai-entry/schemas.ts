import { z } from 'zod';

export const selectionSchema = z.object({ code: z.string().regex(/^[A-Z0-9_-]{1,16}$/), quantity: z.number().int().min(1).max(100) }).strict();
// The owner authorized Groq requests limited to nonpersonal publication choices.
// Strict schemas deliberately exclude text, customer names, phones, flats and addresses.
export const proposalInput = z.object({
  consentToGroq: z.literal(true),
  startDate: z.iso.date(),
  selections: z.array(selectionSchema).min(1).max(30),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.selections.map(item => item.code)).size !== value.selections.length) ctx.addIssue({ code: 'custom', message: 'Choose each newspaper once', path: ['selections'] });
});
export type ProposalInput = z.infer<typeof proposalInput>;
export interface PublicPaper { code: string; name: string }
export interface PublicPayload { startDate: string; publications: { code: string; name: string; quantity: number }[] }
export const proposalOutput = z.object({ subscriptions: z.array(z.object({ code: z.string(), quantity: z.number().int(), startDate: z.iso.date() }).strict()).min(1).max(30) }).strict();
export type ProposalOutput = z.infer<typeof proposalOutput>;
