import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Merriweather } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const merriweather = Merriweather({
  weight: ["300", "400", "700"],
  subsets: ["latin"],
  variable: "--font-merriweather",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0b0f17",
};

export const metadata: Metadata = {
  title: "AI Study Workspace — Digital Textbook + YouTube Lecture + Context-Aware AI Tutor",
  description:
    "Read your textbook, watch lectures, and learn with an AI tutor on a single unified screen. The next-generation academic workspace for students.",
  keywords: [
    "AI Study Workspace",
    "Textbook Reader",
    "YouTube Lecture Sync",
    "AI Academic Tutor",
    "RAG",
    "Computer Networks",
    "Socratic Learning",
  ],
  authors: [{ name: "AI Study Workspace Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <head>
        {/* KaTeX Math Styling */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css"
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${inter.variable} ${merriweather.variable} ${jetbrainsMono.variable} font-sans bg-slate-950 text-slate-100 antialiased overflow-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
