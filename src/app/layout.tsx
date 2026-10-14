import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "shutterbug.",
  description:
    "A filmmaker portfolio — a study in gritty black & white web design with a bootable OS shell, a real-time 3D console and a scroll-driven composition.",
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' fill='%23fff'/%3E%3Ctext x='16' y='23' font-family='Helvetica,Arial' font-size='20' font-style='italic' text-anchor='middle' fill='%23000'%3Eb%3C/text%3E%3C/svg%3E",
  },
  openGraph: {
    title: "shutterbug.",
    description: "Filmmaker portfolio — boot it up, work the console.",
    images: ["/assets/works/work0.jpg"],
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="is-booting antialiased">{children}</body>
    </html>
  );
}
