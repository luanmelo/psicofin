import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PsicoFin",
    short_name: "PsicoFin",
    description: "Controle financeiro mensal para psicólogos.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4faf8",
    theme_color: "#153d36",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
