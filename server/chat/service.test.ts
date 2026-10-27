import { expect, it, vi } from 'vitest';
import type { Db } from 'mongodb';
import { allowedTools, executeTool, answerMessage } from './service.js';
it('gives staff only route tools and rejects model supplied identity arguments', async () => {
  const scope = { userId: 'u', societyId: 'a', role: 'staff' as const, staffId: 's' };
  expect(allowedTools(scope)).toEqual(['getMyRoute']);
  const collection = vi.fn();
  await expect(executeTool({ collection } as unknown as Db, scope, 'listMyInvoices', {})).rejects.toThrow('authorized');
  await expect(executeTool({ collection } as unknown as Db, scope, 'getMyRoute', { societyId: 'victim' })).rejects.toThrow();
  expect(collection).not.toHaveBeenCalled();
});

it('answers known account intents without sending raw text, history or personal tool fields to Groq', async () => {
  const sent: string[] = [];
  const rows = [{ id: 'secret-customer-id', name: 'Private Reader', unit: 'Private Flat', address: 'Private Address', reference: 'Private Receipt', startDate: '2026-01-01', quantity: 2 }];
  const db = { collection: () => ({ find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => rows }) }) }) }) } as unknown as Db;
  const fetch = vi.fn(async (_url: string, options: RequestInit) => {
    sent.push(String(options.body));
    return new Response(JSON.stringify({ choices: [{ message: sent.length === 1 ? { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', function: { name: 'listMySubscriptions', arguments: '{}' } }] } : { role: 'assistant', content: 'Two copies.' } }] }));
  });
  vi.stubGlobal('fetch', fetch);
  try {
    const result = await answerMessage(db, { mongoUri: 'mongodb://localhost', database: 'test', origin: 'http://localhost', port: 3001, production: false, groqKey: 'key', groqModel: 'test' }, { userId: 'user', societyId: 'business', role: 'admin' }, 'Show subscriptions for Private Name, phone 9000011111', [{ role: 'user', content: 'Old private message' }]);
    expect(result.text).toBe('Two copies.');
    expect(result.references).toEqual([{ id: 'secret-customer-id', resource: 'subscriptions' }]);
    for (const value of ['Private Name', '9000011111', 'Old private message', 'secret-customer-id', 'Private Reader', 'Private Flat', 'Private Address', 'Private Receipt']) expect(sent.join('\n')).not.toContain(value);
    expect(sent[1]).toContain('2026-01-01');
  } finally { vi.unstubAllGlobals(); }
});

it('declines unrelated free text locally without an external request', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
  try {
    const result = await answerMessage({} as Db, { mongoUri: 'mongodb://localhost', database: 'test', origin: 'http://localhost', port: 3001, production: false, groqKey: 'key', groqModel: 'test' }, { userId: 'u', societyId: 's', role: 'admin' }, 'Tell me a joke about a private customer');
    expect(result.text).toContain('newspaper');
    expect(fetch).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
it('recognizes the Malayalam balance shortcut and requests the selected response language without raw text',async()=>{
  let body='';vi.stubGlobal('fetch',async(_url:string,options:RequestInit)=>{body=String(options.body);return new Response(JSON.stringify({choices:[{message:{role:'assistant',content:'കുടിശ്ശിക ലഭ്യമല്ല.'}}]}));});
  try{
    await answerMessage({} as Db,{mongoUri:'mongodb://localhost',database:'test',origin:'http://localhost',port:3001,production:false,groqKey:'key',groqModel:'test'},{userId:'u',societyId:'s',role:'admin'},'എന്റെ കുടിശ്ശിക എത്രയാണ്?',[],'ml-IN');
    expect(body).toContain('Malayalam');expect(body).not.toContain('എന്റെ കുടിശ്ശിക എത്രയാണ്?');
  }finally{vi.unstubAllGlobals();}
});
