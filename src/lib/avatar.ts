export function createAvatarDataUrl(name: string) {
  const trimmedName = name.trim() || 'User';
  const initials = trimmedName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const hash = Array.from(trimmedName).reduce((accumulator, character) => accumulator * 31 + character.charCodeAt(0), 0);
  const hue = Math.abs(hash) % 360;
  const secondaryHue = (hue + 42) % 360;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${trimmedName}">
      <defs>
        <linearGradient id="avatar-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue} 72% 52%)" />
          <stop offset="100%" stop-color="hsl(${secondaryHue} 72% 40%)" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="60" fill="url(#avatar-gradient)" />
      <text
        x="50%"
        y="54%"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="Arial, sans-serif"
        font-size="44"
        font-weight="700"
        fill="#ffffff"
      >${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg.trim())}`;
}