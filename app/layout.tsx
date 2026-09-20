import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import "./globals.css";
import LearningRefreshOnExit from "./learning-refresh-on-exit";

/**
 * Loaded through next/font rather than the Google stylesheet link: the files are
 * fetched at build time and served from this origin, so there is no third-party
 * request at runtime, no preconnect, and no flash of fallback text.
 */
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-space-mono",
});

export const metadata: Metadata = {
  title: "CV Factory",
  description: "Strategic CV and cover letter generation with feedback loops",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={spaceMono.variable}>
      <body>
        {children}
        <LearningRefreshOnExit />
      </body>
    </html>
  );
}
