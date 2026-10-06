/**
 * Lightweight seal for localStorage values.
 * Not a substitute for server-side secrets — just keeps casual snoopers
 * from reading roles/names as plain JSON in DevTools.
 */

const PREFIX = 'av1.'

/** App-local mixing key (browser-only obfuscation). */
const MIX =
  'avalon·میز·گرد·بی‌میزبان·v1·d4af69·f5efe6·0c0a09'

function keyBytes(): Uint8Array {
  const enc = new TextEncoder()
  return enc.encode(MIX)
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin)
}

function fromBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function xor(data: Uint8Array, key: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i]! ^ key[i % key.length]!
  }
  return out
}

/** Seal a UTF-8 string for storage. */
export function sealText(plain: string): string {
  const raw = new TextEncoder().encode(plain)
  const mixed = xor(raw, keyBytes())
  return PREFIX + toBase64(mixed)
}

/**
 * Unseal a stored value. Accepts sealed `av1.…` or legacy plain JSON
 * so old saves still load, then can be rewritten sealed.
 */
export function unsealText(stored: string): { text: string; legacy: boolean } | null {
  if (!stored) return null

  if (stored.startsWith(PREFIX)) {
    const bytes = fromBase64(stored.slice(PREFIX.length))
    if (!bytes) return null
    try {
      const plain = new TextDecoder().decode(xor(bytes, keyBytes()))
      return { text: plain, legacy: false }
    } catch {
      return null
    }
  }

  // Legacy plaintext JSON
  const trimmed = stored.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return { text: stored, legacy: true }
  }
  return null
}

export function readSealedJson<T>(key: string): { value: T; legacy: boolean } | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const opened = unsealText(raw)
    if (!opened) return null
    return { value: JSON.parse(opened.text) as T, legacy: opened.legacy }
  } catch {
    return null
  }
}

export function writeSealedJson(key: string, value: unknown) {
  localStorage.setItem(key, sealText(JSON.stringify(value)))
}
