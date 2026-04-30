export function createBlurDataURL(accent = 'rgba(255,255,255,0.28)') {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${accent}" />
          <stop offset="100%" stop-color="rgba(255,255,255,0.04)" />
        </linearGradient>
      </defs>
      <rect width="120" height="80" fill="url(#g)" />
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

