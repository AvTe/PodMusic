import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';

// Poppins is not a variable font — every weight used must be requested here.
const poppins = Poppins({
  variable: '--font-poppins',
  subsets:  ['latin'],
  weight:   ['300', '400', '500', '600', '700'],
  display:  'swap',
});

export const metadata: Metadata = {
  title:       'OSHO · Discourses',
  description: 'Osho discourses, layered with ambient sound.',
};

export default function OshoLayout({ children }: { children: React.ReactNode }) {
  return <div className={poppins.variable}>{children}</div>;
}
