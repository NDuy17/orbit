const DEFAULT_AVATAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#E5E7EB"/>
  <circle cx="256" cy="185" r="92" fill="#737A7D"/>
  <path d="M72 512c0-118 82-190 184-190s184 72 184 190H72z" fill="#737A7D"/>
</svg>`;

const DEFAULT_AVATAR_URL = `data:image/svg+xml;utf8,${encodeURIComponent(DEFAULT_AVATAR_SVG)}`;

export default DEFAULT_AVATAR_URL;
