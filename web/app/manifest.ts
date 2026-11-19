import type { MetadataRoute } from 'next';

// Ajouté à l'écran d'accueil, Ghost s'ouvre comme une application, avec son icône.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Ghost',
    short_name: 'Ghost',
    description: 'Ghost repère vos tâches répétitives et les confie à un agent.',
    start_url: '/workflows',
    display: 'standalone',
    background_color: '#f7f7f5',
    theme_color: '#0b1d45',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }, { src: '/apple-icon', sizes: '180x180', type: 'image/png' }],
  };
}
