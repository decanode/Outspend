// Single entry point for decoding text handed to the app by the iOS Shortcut
// (outspend://capture?text=<Base64>) or any other non-SMS capture path.

const decodeBase64Utf8 = (value) => {
  let b64 = value.trim().replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4 !== 0) b64 += '='
  const binary = atob(b64)
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

// Decodes Base64 (UTF-8) text; falls back to the raw value if it isn't valid Base64/UTF-8.
export const decodeCaptureText = (raw) => {
  if (typeof raw !== 'string' || raw.length === 0) return ''
  try {
    const decoded = decodeBase64Utf8(raw)
    return decoded.length > 0 ? decoded : raw
  } catch {
    return raw
  }
}
