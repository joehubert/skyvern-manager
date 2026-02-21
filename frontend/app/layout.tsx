import type { Metadata } from "next";
import NavSidebar from "../components/NavSidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Skyvern Manager",
  description: "Utility features for Skyvern cloud automation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
          <NavSidebar />
          <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
