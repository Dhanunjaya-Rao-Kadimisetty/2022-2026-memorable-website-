function sanitizeFilenamePart(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

export function buildDownloadFilename(title: string, url: string) {
  const safeTitle = sanitizeFilenamePart(title) || 'download';

  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.trim().toLowerCase();
    return ext ? `${safeTitle}.${ext}` : safeTitle;
  } catch {
    return safeTitle;
  }
}

export async function downloadMedia(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
