import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';

// Poppins is not a variable font — every weight used must be requested here.
const poppins = Poppins({
  variable: '--font-poppins',
  subsets:  ['latin'],
  weight:   ['300', '400', '500', '600', '700'],
  display:  'swap',
});

const TITLE = 'OSHO · Discourses';
const DESCRIPTION = 'Osho discourses, layered with ambient sound.';

// The og/twitter images themselves come from the opengraph-image.jpg /
// twitter-image.jpg files in this folder — Next emits their tags automatically.
export const metadata: Metadata = {
  title:       TITLE,
  description: DESCRIPTION,
  openGraph: {
    type:        'website',
    url:         '/',
    siteName:    TITLE,
    title:       TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card:        'summary_large_image',
    title:       TITLE,
    description: DESCRIPTION,
  },
};

export default function OshoLayout({ children }: { children: React.ReactNode }) {
  return <div className={poppins.variable}>{children}</div>;
}
