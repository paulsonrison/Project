import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (err, key) => err ? reject(err) : resolve(key)));
}
export async function hashPassword(password: string) {
  const salt = randomBytes(32).toString('hex');
  return `scrypt$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(encoded: string, password: string) {
  const [algorithm, salt, hash] = encoded.split('$');
  if (algorithm !== 'scrypt' || !/^[a-f0-9]{64}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(hash ?? '')) return false;
  return timingSafeEqual(Buffer.from(hash, 'hex'), await derive(password, salt));
}
