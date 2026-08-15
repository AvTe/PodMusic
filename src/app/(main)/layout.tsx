import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';

import {
  SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL,
} from '@/lib/site';

// Poppins is not a variable font — every weight used must be requested here.
const poppins = Poppins({
  variable: '--font-poppins',
  subsets:  ['latin'],
  weight:   ['300', '400', '500', '600', '700'],
  display:  'swap',
});

// The og/twitter images themselves come from the opengraph-image.jpg /
// twitter-image.jpg files in this folder — Next emits their tags automatically.
export const metadata: Metadata = {
  title:       SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords:    SITE_KEYWORDS,
  category:    'Spirituality',
  alternates:  { canonical: '/' },
  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:                true,
      follow:               true,
      'max-image-preview':  'large',
      'max-snippet':        -1,
      'max-video-preview':  -1,
    },
  },
  openGraph: {
    type:            'website',
    url:             '/',
    siteName:        SITE_NAME,
    title:           SITE_NAME,
    description:     SITE_DESCRIPTION,
    locale:          'en_IN',
    alternateLocale: ['hi_IN'],
  },
  twitter: {
    card:        'summary_large_image',
    title:       SITE_NAME,
    description: SITE_DESCRIPTION,
  },
};

/**
 * Structured data. Kept deliberately modest: the site is a player, so it
 * describes itself as a WebApplication and says plainly that it neither hosts
 * nor is affiliated with the source material.
 */
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type':      'WebSite',
      '@id':        `${SITE_URL}/#website`,
      url:          SITE_URL,
      name:         SITE_NAME,
      description:  SITE_DESCRIPTION,
      inLanguage:   ['en', 'hi'],
    },
    {
      '@type':                  'WebApplication',
      '@id':                    `${SITE_URL}/#app`,
      url:                      SITE_URL,
      name:                     SITE_NAME,
      applicationCategory:      'MultimediaApplication',
      operatingSystem:          'Any',
      browserRequirements:      'Requires JavaScript and a modern browser',
      isAccessibleForFree:      true,
      inLanguage:               ['en', 'hi'],
      description:              SITE_DESCRIPTION,
      disambiguatingDescription:
        'An independent, non-commercial listening tool. It hosts no audio and is not ' +
        'affiliated with, endorsed by or connected to Osho International Foundation or ' +
        'any other rights holder.',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      featureList: [
        'Plays a full discourse series in one continuous playlist',
        'Ambient background sound layered under the narration',
        'Resumes at the exact position you stopped',
        'Sleep timer and adjustable playback speed',
        'Offline playback of already-heard audio',
      ],
    },
  ],
};

export default function OshoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={poppins.variable}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      {children}
    </div>
  );
}
