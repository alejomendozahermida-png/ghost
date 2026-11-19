import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Un package-lock.json dans le dossier personnel trompe Turbopack sur la racine du projet.
  turbopack: { root: __dirname },
};

export default nextConfig;
