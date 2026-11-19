/** The markup inside a data:image/svg+xml image, when the address is one. */
export function svgDataPayload(decoded: string): string | null {
  const comma = decoded.indexOf(',');
  if (comma < 0) {
    return null;
  }
  const header = decoded.slice(0, comma).toLowerCase().replaceAll(/\s+/g, '');
  if (!header.startsWith('data:image/svg+xml')) {
    return null;
  }
  const body = decoded.slice(comma + 1);
  return header.includes(';base64') ? decodeBase64(body) : body;
}

function decodeBase64(body: string): string | null {
  try {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}
