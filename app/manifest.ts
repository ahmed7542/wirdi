import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "وِردي | رفيق الحفظ والمراجعة",
    short_name: "وِردي",
    description: "مصحف للحفظ والمراجعة بالتلاوة المتصلة والتكرار.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7f6f1",
    theme_color: "#276653",
    lang: "ar",
    dir: "rtl",
    icons: [
      {
        src: "/icons/wird-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/wird-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/wird-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
