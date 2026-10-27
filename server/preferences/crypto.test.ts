import { expect,it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { sealKey,openKey } from './crypto.js';
it('uses unique authenticated envelopes and rejects tampering or another tenant',()=>{
  const master=randomBytes(32).toString('base64'),a=sealKey('synthetic-provider-key',master,'business-a'),b=sealKey('synthetic-provider-key',master,'business-a');
  expect(a.nonce).not.toBe(b.nonce);expect(JSON.stringify(a)).not.toContain('synthetic-provider-key');
  expect(openKey(a,[master],'business-a')).toBe('synthetic-provider-key');
  expect(()=>openKey(a,[master],'business-b')).toThrow();
  expect(()=>openKey({...a,ciphertext:a.ciphertext.slice(0,-4)+'AAAA'},[master],'business-a')).toThrow();
});
it('supports explicit rotation by reading old envelopes and resealing with the active key',()=>{
  const old=randomBytes(32).toString('base64'),next=randomBytes(32).toString('base64'),sealed=sealKey('synthetic-key',old,'a');
  expect(openKey(sealed,[next,old],'a')).toBe('synthetic-key');
  const rotated=sealKey(openKey(sealed,[next,old],'a'),next,'a');
  expect(openKey(rotated,[next],'a')).toBe('synthetic-key');expect(()=>openKey(rotated,[old],'a')).toThrow();
});
