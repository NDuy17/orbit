const MOJIBAKE_PATTERN = /(?:Ã|Â|Æ|Ä|áº|á»|â)/;

export function fixMojibake(value) {
  if (typeof value !== 'string' || !MOJIBAKE_PATTERN.test(value)) {
    return value;
  }

  try {
    const bytes = Uint8Array.from([...value].map((char) => char.charCodeAt(0) & 255));
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder('utf-8').decode(bytes);
    }

    return decodeURIComponent(
      Array.from(bytes)
        .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
        .join('')
    );
  } catch {
    return value;
  }
}

export function textOr(value, fallback = '') {
  const fixed = fixMojibake(value);
  return fixed || fallback;
}
