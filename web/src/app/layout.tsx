web/src/app/layout.tsx

import { ReactNode } from "react";
import { WalletProviders } from "../components/WalletProviders";
import { Navbar } from "../components/Navbar";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1a1a1a" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
      </head>
      <body>
        <WalletProviders>
          <Navbar />
          <div style={{ padding: 16 }}>{children}</div>
        </WalletProviders>
      </body>
    </html>
  );
}
