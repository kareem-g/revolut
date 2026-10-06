import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "powerk cloud",
  description: "Local control for your power strip — from anywhere.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#121410", color: "#E7E9E3", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
