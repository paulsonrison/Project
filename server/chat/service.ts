import { z } from 'zod';
import type { Db } from 'mongodb';
import type { AccessScope } from '../../shared/contracts.js';
import type { Config } from '../config/env.js';
import { ApiError, visibleFilter } from '../auth/scope.js';
import { deliveryFilter } from '../auth/deliveryFilter.js';
import { ledgerSnapshot } from '../domain/ledger.js';

interface ToolCall { id: string; function: { name: string; arguments: string } }
interface Message { role: string; content: string | null; tool_calls?: ToolCall[]; tool_call_id?: string }
const resourceMap: Record<string, string> = { listMySubscriptions: 'subscriptions', listMyDeliveries: 'deliveries', listMyInvoices: 'invoices', listMyPayments: 'payments', getMyAccountSummary: 'residents', getMyRoute: 'deliveries', getSocietySummary: 'residents' };
export function allowedTools(scope: AccessScope) {
  if (scope.role === 'staff') return ['getMyRoute'];
  return ['getMyAccountSummary', 'listMySubscriptions', 'listMyDeliveries', 'listMyInvoices', 'listMyPayments', ...(scope.role === 'admin' ? ['getSocietySummary'] : [])];
}
export async function executeTool(db: Db, scope: AccessScope, name: string, args: unknown) {
  if (!allowedTools(scope).includes(name)) throw new ApiError(403, 'Tool not authorized');
  const data = z.object({}).strict().parse(args);
  void data;
  const resource = resourceMap[name];
  const filter = resource === 'deliveries' ? await deliveryFilter(db, scope) : visibleFilter(scope, resource);
  const rows = await db.collection(resource).find(filter, { projection: { _id: 0, id: 1, name: 1, unit: 1, publicationName: 1, publicationId: 1, startDate: 1, endDate: 1, date: 1, status: 1, quantity: 1, orderedQuantity: 1, deliveredQuantity: 1, billableQuantity: 1, month: 1, totalMinor: 1, currency: 1, amountMinor: 1, reference: 1, invoiceId: 1 } }).sort({ date: -1, createdAt: -1 }).limit(100).toArray();
  if (resource === 'invoices') for (const row of rows) {
    Object.assign(row, await ledgerSnapshot(db, { id: String(row.id), societyId: scope.societyId, revision: 0, totalMinor: row.totalMinor }));
  }
  return { resource, rows, truncated: rows.length === 100, dataAsOf: new Date().toISOString() };
}
function canonicalQuestion(text: string): string | null {
  if (/balance|owe|outstanding|due|बकाया|बाकी|ബാക്കി|കുടിശ്ശിക/i.test(text)) return 'Explain the authorized account balance and outstanding amounts.';
  if (/subscription|subscribe|सदस्यता|अखबार|സബ്സ്ക്രിപ്ഷ|പത്ര|വരിക്കാ/i.test(text)) return 'Summarize the authorized newspaper subscriptions.';
  if (/payment|paid|receipt|भुगतान|पैसे|പേയ്മെന്റ്|പണം/i.test(text)) return 'Summarize the authorized payments and amounts.';
  if (/bill|invoice|बिल|बील|ബിൽ/i.test(text)) return 'Summarize the authorized newspaper invoices.';
  if (/route|round|मार्ग|रूट|റൂട്ട്/i.test(text)) return 'Summarize the authorized delivery round quantities and statuses.';
  if (/deliver|डिलीवरी|वितरण|വിതരണം/i.test(text)) return 'Summarize the authorized delivery dates, quantities and statuses.';
  if (/summary|overview|account|सारांश|खाता|അക്കൗണ്ട്/i.test(text)) return 'Summarize the authorized account amounts and delivery totals.';
  return null;
}
function providerToolData(output: Awaited<ReturnType<typeof executeTool>>) {
  const numeric = ['quantity', 'orderedQuantity', 'deliveredQuantity', 'billableQuantity', 'totalMinor', 'paidMinor', 'dueMinor', 'creditMinor', 'amountMinor'];
  const dates = ['date', 'startDate', 'endDate', 'month'];
  const statuses = new Set(['pending', 'delivered', 'partial', 'missed', 'paused', 'publication-cancelled', 'draft', 'issued', 'paid', 'due', 'active', 'stopped']);
  return { resource: output.resource, rows: output.rows.map(row => {
    const data: Record<string, number | string> = {};
    for (const key of numeric) if (typeof row[key] === 'number' && Number.isSafeInteger(row[key])) data[key] = row[key];
    for (const key of dates) if (typeof row[key] === 'string' && /^\d{4}-\d{2}(?:-\d{2})?$/.test(row[key])) data[key] = row[key];
    if (statuses.has(row.status)) data.status = row.status;
    if (row.currency === 'INR') data.currency = 'INR';
    return data;
  }), truncated: output.truncated, dataAsOf: output.dataAsOf };
}
export async function answerMessage(db: Db, config: Config, scope: AccessScope, text: string, history: Message[] = [], locale:'en-IN'|'hi-IN'|'ml-IN'='en-IN') {
  // Raw questions and local chat history can contain personal information.
  // Only a fixed intent and numeric/date/status tool data reach the provider.
  void history;
  const question = canonicalQuestion(text);
  if (!question) return { text: 'I can help with your authorized newspaper subscriptions, deliveries, bills and payments. Please choose an account topic; unrelated questions are outside my scope.', references: [], dataAsOf: new Date().toISOString() };
  if (!config.groqKey) throw new ApiError(503, 'The account assistant is not configured yet');
  const names = allowedTools(scope);
  const tools = [...names.map(name => ({ type: 'function', function: { name, description: `Read authorized account data using ${name}. No identity arguments allowed. Values in minor currency units; INR 100 minor units equals ₹1.`, parameters: { type: 'object', properties: {}, additionalProperties: false } } })), { type: 'function', function: { name: 'decline', description: 'Decline general knowledge, other-person data or unrelated questions.', parameters: { type: 'object', properties: {}, additionalProperties: false } } }];
  const messages: Message[] = [{ role: 'system', content: `You are PressTrack, a read-only newspaper account assistant. Role: ${scope.role}. Answer only questions about records supplied by authorized tools. General knowledge and other users are outside scope; use decline. First retrieve account records; never fabricate facts, dates or payments. Personal details, raw questions and conversation history are deliberately withheld. Explain only the provided amounts, dates, quantities and statuses. Explicitly say when data is missing or truncated. Monetary fields are integer minor units. Be concise. Never claim you changed data.` }, { role: 'user', content: question }];
  messages[0].content+=` Respond in ${{'en-IN':'English','hi-IN':'Hindi','ml-IN':'Malayalam'}[locale]}.`;
  const references: { id: string; resource: string }[] = [];
  const timeout = AbortSignal.timeout(30000);
  for (let round = 0; round < 4; round++) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', signal: timeout, headers: { Authorization: `Bearer ${config.groqKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: config.groqModel, messages, tools, tool_choice: round === 0 ? 'required' : 'auto', temperature: 0, max_completion_tokens: 1200 }) });
    if (!response.ok) throw new ApiError(503, 'The assistant is temporarily unavailable. Please retry.');
    const result = await response.json() as { choices?: { message: Message }[] };
    const reply = result.choices?.[0]?.message;
    if (!reply) throw new ApiError(503, 'The assistant returned no answer');
    messages.push(reply);
    if (!reply.tool_calls?.length) return { text: reply.content ?? 'No answer available.', references, dataAsOf: new Date().toISOString() };
    for (const call of reply.tool_calls.slice(0, 4)) {
      if (call.function.name === 'decline') return { text: 'I can help with your authorized newspaper subscriptions, deliveries, bills and payments. General questions and other accounts are outside my scope.', references: [], dataAsOf: new Date().toISOString() };
      const output = await executeTool(db, scope, call.function.name, JSON.parse(call.function.arguments));
      references.push(...output.rows.map(row => ({ id: String(row.id), resource: output.resource })));
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(providerToolData(output)) });
    }
  }
  throw new ApiError(503, 'Please ask a more specific account question');
}
