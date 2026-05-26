// src/config.ts
export const site = {
  name: 'Off-Pat Ceramics',
  tagline: 'Porcelain & Stoneware • Paintings in Clay',
  location: 'Felixstowe, Suffolk',
  established: '2024',

  email: 'offpat4@gmail.com',
  phone: '07702 490932',
  address: {
    line1: 'The Studio',
    line2: '3 Penfold Road',
    city: 'Felixstowe',
    region: 'Suffolk',
    postcode: 'IP11 7BP',
  },

  social: {
    instagram: 'https://instagram.com/off_pat',
    etsy: '',
    newsletter: '#',
  },

  footerStrap: 'Hand-thrown porcelain and stoneware from Felixstowe',
};

// Navigation — cleaned up
export const nav = [
  { label: 'Work', href: '/gallery' },
  { label: 'Journal', href: '/journal' },
  { label: 'Studio', href: '/about' },
  { label: 'Contact', href: '/contact' },
];