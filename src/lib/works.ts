/* ------------------------------------------------------------------
   THE ARCHIVE — works loaded into the machine.

   These are PLACEHOLDER entries backed by generated artwork
   (public/assets/works/*.jpg, public/assets/reels/*.mp4).

   To make it yours, replace each item:
     img       poster shown on the screen at first paint (jpg)
     vid       optional 6s muted loop swapped in when it arrives (mp4)
     link      where the rail arrow / X key sends the visitor
     vertical  read off the actual file, never guessed
   ------------------------------------------------------------------ */

export type Work = {
  id: string;
  title: string;
  sub: string;
  kind: string;
  year: string;
  meta: string;
  img: string;
  vid?: string;
  link: string;
  vertical?: boolean;
  featured?: boolean;
};

export const WORKS: Work[] = [
  {
    id: "sns",
    title: "Socials",
    sub: "every handle, one reel",
    kind: "MOTION GRAPHIC",
    year: "2026",
    meta: "MOTION · SOCIAL CHANNEL",
    img: "/assets/works/socials.jpg",
    vid: "/assets/reels/socials.mp4",
    link: "https://github.com/e2sy",
    vertical: false,
  },
  {
    id: "w01",
    title: "Night Shift",
    sub: "a story about staying late",
    kind: "SHORT FILM",
    year: "2026",
    meta: "SHORT FILM · SAMPLE · PORTFOLIO",
    img: "/assets/works/work0.jpg",
    vid: "/assets/reels/DW1.mp4",
    link: "#",
    vertical: false,
    featured: true,
  },
  {
    id: "w02",
    title: "Soda City",
    sub: "bottles, buses, neon rain",
    kind: "REEL",
    year: "2026",
    meta: "REEL · SAMPLE · PORTFOLIO",
    img: "/assets/works/work1.jpg",
    vid: "/assets/reels/DW2.mp4",
    link: "#",
    vertical: false,
  },
  {
    id: "w03",
    title: "Long Exposure",
    sub: "the city at 1/8 of a second",
    kind: "REEL",
    year: "2025",
    meta: "REEL · SAMPLE · PORTFOLIO",
    img: "/assets/works/work2.jpg",
    vid: "/assets/reels/DW3.mp4",
    link: "#",
    vertical: false,
  },
  {
    id: "w04",
    title: "Paper Moon",
    sub: "a love letter to streetlight",
    kind: "REEL",
    year: "2026",
    meta: "REEL · SAMPLE · PORTFOLIO",
    img: "/assets/works/work3.jpg",
    vid: "/assets/reels/DW4.mp4",
    link: "#",
    vertical: false,
  },
  {
    id: "w05",
    title: "Static",
    sub: "found footage from channel 0",
    kind: "REEL",
    year: "2025",
    meta: "REEL · SAMPLE · PORTFOLIO",
    img: "/assets/works/work4.jpg",
    vid: "/assets/reels/DW5.mp4",
    link: "#",
    vertical: false,
  },
  {
    id: "w06",
    title: "Grandstand",
    sub: "matchday, from the cheap seats",
    kind: "REEL",
    year: "2025",
    meta: "REEL · SAMPLE · PORTFOLIO",
    img: "/assets/works/work5.jpg",
    vid: "/assets/reels/DW6.mp4",
    link: "#",
    vertical: true,
  },
  {
    id: "w07",
    title: "Monsoon Tape",
    sub: "rain season, three rolls",
    kind: "REEL",
    year: "2026",
    meta: "REEL · SAMPLE · PORTFOLIO",
    img: "/assets/works/work6.jpg",
    vid: "/assets/reels/DW7.mp4",
    link: "#",
    vertical: false,
  },
  {
    id: "w08",
    title: "Low Fidelity",
    sub: "VHS dreams, to be continued",
    kind: "REEL",
    year: "2025",
    meta: "REEL · SAMPLE · PORTFOLIO",
    img: "/assets/works/work7.jpg",
    vid: "/assets/reels/DW8.mp4",
    link: "#",
    vertical: false,
  },
  {
    id: "w09",
    title: "First Light",
    sub: "opening frames of the next one",
    kind: "SHORT FILM",
    year: "2026",
    meta: "SHORT FILM · SAMPLE · PORTFOLIO",
    img: "/assets/works/work8.jpg",
    link: "#",
    vertical: false,
  },
];
