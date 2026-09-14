import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Care D Clinic · Care coordination',
  description: 'ระบบประสานการดูแลผู้ป่วย Care D Clinic',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased">{children}</body>
    </html>
  );
}
