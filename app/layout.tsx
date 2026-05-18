import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
