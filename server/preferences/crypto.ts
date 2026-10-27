import { createCipheriv,createDecipheriv,createHash,randomBytes } from 'node:crypto';
export interface KeyEnvelope { version:1;keyId:string;nonce:string;ciphertext:string;tag:string }
function bytes(value:string){const key=Buffer.from(value,'base64');if(key.length!==32||key.toString('base64')!==value)throw new Error('Invalid encryption configuration');return key;}
const keyId=(key:Buffer)=>createHash('sha256').update(key).digest('hex').slice(0,16);
const context=(societyId:string)=>Buffer.from(JSON.stringify({societyId,provider:'groq',version:1}));
export function sealKey(value:string,master:string,societyId:string):KeyEnvelope {
  const key=bytes(master),nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(context(societyId));
  const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return {version:1,keyId:keyId(key),nonce:nonce.toString('base64'),ciphertext:ciphertext.toString('base64'),tag:cipher.getAuthTag().toString('base64')};
}
export function openKey(envelope:KeyEnvelope,masters:string[],societyId:string):string {
  if(envelope.version!==1)throw new Error('Unsupported encryption version');
  const key=masters.map(bytes).find(k=>keyId(k)===envelope.keyId);if(!key)throw new Error('Encryption key unavailable');
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.nonce,'base64'));decipher.setAAD(context(societyId));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext,'base64')),decipher.final()]).toString('utf8');
}
