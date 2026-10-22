import { gcm } from '@noble/ciphers/aes.js'
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js'
import { sha256 } from '@noble/hashes/sha2.js'

// AES-256-GCM with a key derived from the user's passphrase (PBKDF2-SHA256).
// The salt, IV and iteration count travel with the file; the passphrase never does.
export const BACKUP_VERSION = 1
export const DEFAULT_ITERATIONS = 100000

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export const toBase64 = (bytes) => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '='
    out += i + 2 < bytes.length ? B64[n & 63] : '='
  }
  return out
}

export const fromBase64 = (str) => {
  const clean = str.replace(/=+$/, '')
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4))
  let o = 0
  for (let i = 0; i < clean.length; i += 4) {
    const n = [0, 1, 2, 3].reduce((acc, k) => {
      const idx = i + k < clean.length ? B64.indexOf(clean[i + k]) : 0
      return (acc << 6) | idx
    }, 0)
    if (o < out.length) out[o++] = (n >> 16) & 255
    if (o < out.length) out[o++] = (n >> 8) & 255
    if (o < out.length) out[o++] = n & 255
  }
  return out
}

const deriveKey = (passphrase, salt, iterations) =>
  pbkdf2Async(sha256, new TextEncoder().encode(passphrase), salt, { c: iterations, dkLen: 32 })

/**
 * @param {string} plain text to protect
 * @param {string} passphrase
 * @param {{ randomBytes: (n:number)=>Uint8Array, iterations?: number }} opts
 */
export const encryptText = async (plain, passphrase, { randomBytes, iterations = DEFAULT_ITERATIONS }) => {
  if (!passphrase) throw new Error('A passphrase is required')
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = await deriveKey(passphrase, salt, iterations)
  const data = gcm(key, iv).encrypt(new TextEncoder().encode(plain))
  return JSON.stringify({
    app: 'Outspend', v: BACKUP_VERSION, kdf: 'pbkdf2-sha256', iter: iterations,
    salt: toBase64(salt), iv: toBase64(iv), data: toBase64(data),
  })
}

export class BackupError extends Error {}

export const decryptText = async (blob, passphrase) => {
  let file
  try {
    file = JSON.parse(blob)
  } catch {
    throw new BackupError('This is not an Outspend backup file.')
  }
  if (!file || file.app !== 'Outspend' || !file.data || !file.salt || !file.iv) throw new BackupError('This is not an Outspend backup file.')
  if (file.v !== BACKUP_VERSION) throw new BackupError('This backup was made by a newer version of the app.')
  try {
    const key = await deriveKey(passphrase || '', fromBase64(file.salt), file.iter)
    const plain = gcm(key, fromBase64(file.iv)).decrypt(fromBase64(file.data))
    return new TextDecoder().decode(plain)
  } catch {
    throw new BackupError('Wrong passphrase, or the file is damaged.')
  }
}
