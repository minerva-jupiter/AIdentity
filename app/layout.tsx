import type { Metadata } from "next";
import { Noto_Sans_JP } from 'next/font/google';
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '700'],
  preload: false,
  variable: '--font-noto-sans-jp',
  display: 'swap',
})

export const metadata: Metadata = {
  title: "AIdentity",
  description: "Op31 by minerva_juppiter",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="jp" className={notoSansJp.variable}>
      <body>
        {children}
      </body>
    </html>
  );
}
