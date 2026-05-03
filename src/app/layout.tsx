import type { Metadata, Viewport } from 'next';
import { BrowserViewportSync } from '@/components/BrowserViewportSync';
import './globals.css';

export const metadata: Metadata = {
  title: '赛车联机大厅',
  description: 'Starter Kit Racing 在线房间与发车流程'
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <BrowserViewportSync />
        {children}
      </body>
    </html>
  );
}
