import React from 'react';

export function PlannerBow({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 100 72" fill="none" aria-hidden="true">
    <path d="M44 34C30 17 9 9 7 25C4 45 22 55 44 40M56 34C70 17 91 9 93 25C96 45 78 55 56 40" fill="#fff2f6" stroke="#bb6387" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M45 40L31 63L46 60L51 48L58 62L72 65L57 40" fill="#ffe7ef" stroke="#bb6387" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M43 33L22 29M43 40L23 43M57 33L78 29M57 40L77 43" stroke="#e9a9c1" strokeWidth="2.5" strokeLinecap="round" />
    <rect x="41" y="29" width="19" height="17" rx="6" fill="#ed9cbb" stroke="#bb6387" strokeWidth="2.5" />
  </svg>;
}

export function PocketFriend({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 160 130" fill="none" aria-hidden="true">
    <path d="M46 94C24 80 26 54 41 39L40 16C50 10 65 18 70 29C78 27 89 28 96 31C103 21 116 14 123 20L120 46C137 68 126 94 112 99" fill="#fffdf4" stroke="#b78295" strokeWidth="2.5" strokeLinejoin="round" />
    <path d="M43 26L44 41L55 33M115 29L113 44L104 36" fill="#f3bdd0" />
    <ellipse cx="52" cy="68" rx="9" ry="5" fill="#f6c5d5" /><ellipse cx="104" cy="68" rx="9" ry="5" fill="#f6c5d5" />
    <path d="M61 56V61M95 56V61M74 66L79 69L84 66M79 69C76 76 70 72 70 70M79 69C82 76 88 72 88 70" stroke="#76505e" strokeWidth="3" strokeLinecap="round" />
    <rect x="39" y="86" width="82" height="30" rx="7" fill="#dfd5ef" stroke="#ab94bd" strokeWidth="2" />
    <path d="M80 89V113M50 97H69M91 97H110M50 103H69M91 103H110" stroke="#b5a3c6" strokeWidth="2" strokeLinecap="round" />
    <ellipse cx="45" cy="89" rx="10" ry="6" fill="#fffdf4" stroke="#b78295" strokeWidth="2" /><ellipse cx="115" cy="89" rx="10" ry="6" fill="#fffdf4" stroke="#b78295" strokeWidth="2" />
    <path d="M22 55L25 48L28 55L35 58L28 61L25 68L22 61L15 58Z" fill="#f1d68e" /><path d="M136 82L139 76L142 82L148 85L142 88L139 94L136 88L130 85Z" fill="#f1d68e" />
    <path d="M132 33C126 24 140 24 137 32C145 27 150 39 132 43Z" fill="#e6a0bb" />
  </svg>;
}
