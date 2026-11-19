import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Écran d'accueil du téléphone et icône des notifications : le fantôme sur le fond clair de Ghost (une icône d'iPhone ne peut pas être transparente).
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 92"><path fill="#0b1d45" fill-rule="evenodd" d="M12 65 C18 58 24 48 27 37 C31 22 42 6 58 6 C76 6 88 20 88 39 C88 62 72 79 40 83 C43 78 42 70 36 67 C30 64 20 66 13 66.5 Z M52 21 H70 A13 13 0 0 1 83 34 V39 A13 13 0 0 1 70 52 H52 A13 13 0 0 1 39 39 V34 A13 13 0 0 1 52 21 Z"/><rect fill="#0b1d45" x="57" y="30" width="7.5" height="14" rx="3.75"/><rect fill="#0b1d45" x="72" y="30" width="7.5" height="14" rx="3.75"/></svg>`;

export default function IconeApple() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f5' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendu en image par next/og */}
        <img src={`data:image/svg+xml;base64,${Buffer.from(SVG).toString('base64')}`} width={124} height={114} alt="" />
      </div>
    ),
    size,
  );
}
