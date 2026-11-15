import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
import Go from 'simple-icons-astro/Go';
import Typescript from 'simple-icons-astro/Typescript';
import Nextdotjs from 'simple-icons-astro/Nextdotjs';
import Tailwindcss from 'simple-icons-astro/Tailwindcss';
import Postgresql from 'simple-icons-astro/Postgresql';
import Redis from 'simple-icons-astro/Redis';
import Electron from 'simple-icons-astro/Electron';
import Cloudflare from 'simple-icons-astro/Cloudflare';
import Archlinux from 'simple-icons-astro/Archlinux';
import Zsh from 'simple-icons-astro/Zsh';
import AstroIcon from 'simple-icons-astro/Astro';
import Javascript from 'simple-icons-astro/Javascript';
import Swift from 'simple-icons-astro/Swift';
import Rust from 'simple-icons-astro/Rust';
import Webassembly from 'simple-icons-astro/Webassembly';
import Cplusplus from 'simple-icons-astro/Cplusplus';
import Github from 'simple-icons-astro/Github';
import Discord from 'simple-icons-astro/Discord';
import ArrowUpRight from '@lucide/astro/icons/arrow-up-right';
import Forgejo from '@/components/icons/Forgejo.astro';

type Tech = { name: string; Icon: AstroComponentFactory };
const T = {
  Go: { name: 'Go', Icon: Go },
  TS: { name: 'TypeScript', Icon: Typescript },
  NextJS: { name: 'Next.js', Icon: Nextdotjs },
  Tailwind: { name: 'Tailwind CSS', Icon: Tailwindcss },
  PG: { name: 'PostgreSQL', Icon: Postgresql },
  Redis: { name: 'Redis', Icon: Redis },
  Astro: { name: 'Astro', Icon: AstroIcon },
  Electron: { name: 'Electron', Icon: Electron },
  CF: { name: 'Cloudflare', Icon: Cloudflare },
  ArchLinux: { name: 'Arch Linux', Icon: Archlinux },
  Zsh: { name: 'Zsh', Icon: Zsh },
  JS: { name: 'JavaScript', Icon: Javascript },
  Swift: { name: 'Swift', Icon: Swift },
  Rust: { name: 'Rust', Icon: Rust },
  Wasm: { name: 'WebAssembly', Icon: Webassembly },
  Cpp: { name: 'C++', Icon: Cplusplus },
} satisfies Record<string, Tech>;

export const categories = [
  { id: 'web', label: 'Web' },
  { id: 'desktop', label: 'Desktop' },
  { id: 'tool', label: 'Tool' },
  { id: 'plugin', label: 'Plugin' },
  { id: 'reversing', label: 'Reverse Engineering' },
  { id: 'config', label: 'Config' },
] as const;
export type CategoryId = (typeof categories)[number]['id'];
export const categoryStyle: Record<CategoryId, string> = {
  web: 'bg-blue-900/50 text-blue-300',
  desktop: 'bg-purple-900/50 text-purple-300',
  tool: 'bg-green-900/50 text-green-300',
  plugin: 'bg-teal-900/50 text-teal-300',
  reversing: 'bg-orange-900/50 text-orange-300',
  config: 'bg-gray-700/80 text-gray-300',
};

export type ProjectLink = {
  label: string;
  url: string;
  Icon: typeof Github | typeof Discord | typeof ArrowUpRight | typeof Forgejo;
  tint?: string;
};

export type Project = {
  name: string;
  slug: string;
  description: string;
  link: string;
  image: string | null;
  repo: string | null;
  category: CategoryId;
  tech: Tech[];
  links: ProjectLink[];
};

export const projects: Project[] = [
  {
    name: 'Miwa.lol',
    slug: 'miwa-lol',
    description: 'A modern and customizable biolinks website, already used by more than 3,000 users!',
    link: 'https://miwa.lol',
    image: '/img/miwa.webp',
    repo: null,
    category: 'web',
    tech: [T.NextJS, T.Tailwind, T.TS, T.Go, T.PG, T.Redis],
    links: [
      { label: 'Website', url: 'https://miwa.lol', Icon: ArrowUpRight },
      { label: 'GitHub', url: 'https://github.com/miwalol', Icon: Github },
      {
        label: 'Discord',
        url: 'https://discord.gg/miwa',
        Icon: Discord,
        tint: 'text-[#5865F2]',
      },
    ],
  },
  {
    name: 'Tenshii.moe',
    slug: 'tenshii-moe',
    description: 'My personal website, you are currently on it!',
    link: 'https://tenshii.moe',
    image: '/img/pfp.webp',
    repo: 'https://git.tenshii.moe/Tenshii/tenshii.moe',
    category: 'web',
    tech: [T.Astro, T.TS, T.Tailwind],
    links: [
      { label: 'Website', url: 'https://tenshii.moe', Icon: ArrowUpRight },
      { label: 'Forgejo', url: 'https://git.tenshii.moe/Tenshii/tenshii.moe', Icon: Forgejo },
    ],
  },
  {
    name: 'switch-wasm',
    slug: 'switch-wasm',
    description: 'A from-scratch Nintendo Switch emulator: an ARM64 interpreter and GM20B GPU emulation compiled to WebAssembly. Boots homebrew NROs entirely in your browser, nothing is uploaded.',
    link: 'https://tenshii.moe/Switch-Wasm/',
    image: '/img/switch-wasm.svg',
    repo: 'https://git.tenshii.moe/Tenshii/Switch-Wasm',
    category: 'reversing',
    tech: [T.Rust, T.Wasm],
    links: [
      { label: 'Website', url: 'https://tenshii.moe/Switch-Wasm/', Icon: ArrowUpRight },
      { label: 'Forgejo', url: 'https://git.tenshii.moe/Tenshii/Switch-Wasm', Icon: Forgejo },
    ],
  },
  {
    name: 'XeProxy',
    slug: 'xeproxy',
    description: 'A DashLaunch plugin for the Xbox 360 that hooks the console\'s network layer to rewrite DNS, redirect traffic or tunnel it through an HTTP or SOCKS5 proxy, all from an ini file. Also lets XHttp accept a MITM proxy\'s TLS certificate.',
    link: 'https://git.tenshii.moe/Tenshii/XeProxy',
    image: null,
    repo: 'https://git.tenshii.moe/Tenshii/XeProxy',
    category: 'plugin',
    tech: [T.Cpp],
    links: [{ label: 'Forgejo', url: 'https://git.tenshii.moe/Tenshii/XeProxy', Icon: Forgejo }],
  },
  {
    name: 'Deezer Discord RPC',
    slug: 'deezer-discord-rpc',
    description: 'A Discord RPC for Deezer.',
    link: 'https://github.com/CuteTenshii/deezer-discord-rpc',
    image: '/img/deezer-rpc.webp',
    repo: 'https://github.com/CuteTenshii/deezer-discord-rpc',
    category: 'desktop',
    tech: [T.Electron, T.TS],
    links: [{ label: 'GitHub', url: 'https://github.com/CuteTenshii/deezer-discord-rpc', Icon: Github }],
  },
  {
    name: 'YTM-Swift',
    slug: 'ytm-swift',
    description: 'An unofficial native macOS client for YouTube Music built with SwiftUI. Talks to the InnerTube API directly, and support plugins like Discord Rich Presence and Last.fm.',
    link: 'https://git.tenshii.moe/Tenshii/YTM-Swift',
    image: null,
    repo: 'https://git.tenshii.moe/Tenshii/YTM-Swift',
    category: 'desktop',
    tech: [T.Swift],
    links: [{ label: 'Forgejo', url: 'https://git.tenshii.moe/Tenshii/YTM-Swift', Icon: Forgejo }],
  },
  {
    name: 'guns.lol solver',
    slug: 'guns-lol-solver',
    description: 'Reverse engineering of the PoW used to record views on guns.lol profile pages. The README includes a detailed explanation of how the PoW works.',
    link: 'https://github.com/CuteTenshii/guns-solver',
    image: null,
    repo: 'https://github.com/CuteTenshii/guns-solver',
    category: 'reversing',
    tech: [T.Go],
    links: [{ label: 'GitHub', url: 'https://github.com/CuteTenshii/guns-solver', Icon: Github }],
  },
  {
    name: 'Crunchyroll Downloader',
    slug: 'crunchyroll-downloader',
    description: 'A Go program to download episodes from Crunchyroll. Merges video and audio segments (and optionally subtitles) into a MKV container.',
    link: 'https://github.com/CuteTenshii/crunchyroll-downloader',
    image: null,
    repo: 'https://github.com/CuteTenshii/crunchyroll-downloader',
    category: 'tool',
    tech: [T.Go],
    links: [{ label: 'GitHub', url: 'https://github.com/CuteTenshii/crunchyroll-downloader', Icon: Github }],
  },
  {
    name: 'dotfiles',
    slug: 'dotfiles',
    description: 'My dotfiles for Arch Linux with Hyprland, zsh, kitty... Also includes scripts I made for my VPS.',
    link: 'https://git.tenshii.moe/Tenshii/dotfiles',
    image: '/img/dotfiles.webp',
    repo: 'https://git.tenshii.moe/Tenshii/dotfiles',
    category: 'config',
    tech: [T.ArchLinux, T.Zsh],
    links: [{ label: 'Forgejo', url: 'https://git.tenshii.moe/Tenshii/dotfiles', Icon: Forgejo }],
  },
  {
    name: 'Paradise Bay server',
    slug: 'paradise-bay-server',
    description: 'Reverse-engineering of the custom protocol of the 2015 "Paradise Bay" game.',
    link: 'https://github.com/CuteTenshii/paradise-bay-server',
    image: null,
    repo: 'https://github.com/CuteTenshii/paradise-bay-server',
    category: 'reversing',
    tech: [T.Go],
    links: [{ label: 'GitHub', url: 'https://github.com/CuteTenshii/paradise-bay-server', Icon: Github }],
  },
  {
    name: 'favicon',
    slug: 'favicon',
    description: 'A Cloudflare Worker that serves a website\'s favicon from a given URL.',
    link: 'https://github.com/CuteTenshii/favicon',
    image: null,
    repo: 'https://github.com/CuteTenshii/favicon',
    category: 'tool',
    tech: [T.TS, T.CF],
    links: [{ label: 'GitHub', url: 'https://github.com/CuteTenshii/favicon', Icon: Github }],
  },
  {
    name: 'Deezer Enhancer',
    slug: 'deezer-enhancer',
    description: 'A browser extension that enhances the Deezer web player with additional features and improvements. (Abandoned)',
    link: 'https://github.com/CuteTenshii/deezer-enhancer',
    image: null,
    repo: 'https://github.com/CuteTenshii/deezer-enhancer',
    category: 'tool',
    tech: [T.TS],
    links: [{ label: 'GitHub', url: 'https://github.com/CuteTenshii/deezer-enhancer', Icon: Github }],
  },
  {
    name: 'Wplace.live Datamining',
    slug: 'wplace-live-datamining',
    description: 'Datamining for the Wplace.live website. Extracts and renames files since their hashes change with every new build.',
    link: 'https://github.com/CuteTenshii/wplace-datamining',
    image: null,
    repo: 'https://github.com/CuteTenshii/wplace-datamining',
    category: 'reversing',
    tech: [T.JS],
    links: [{ label: 'GitHub', url: 'https://github.com/CuteTenshii/wplace-datamining', Icon: Github }],
  },
  {
    name: 'guns.lol Datamining',
    slug: 'guns-lol-datamining',
    description: 'Datamining for the guns.lol website.',
    link: 'https://github.com/CuteTenshii/guns-datamining',
    image: null,
    repo: 'https://github.com/CuteTenshii/guns-datamining',
    category: 'reversing',
    tech: [T.JS],
    links: [{ label: 'GitHub', url: 'https://github.com/CuteTenshii/guns-datamining', Icon: Github }],
  },
  {
    name: 'Burger King FR API',
    slug: 'burger-king-fr-api',
    description: 'A Node.js wrapper for the internal Burger King France API.',
    link: 'https://github.com/CuteTenshii/burger-king-fr-api',
    image: null,
    repo: 'https://github.com/CuteTenshii/burger-king-fr-api',
    category: 'tool',
    tech: [T.JS],
    links: [{ label: 'GitHub', url: 'https://github.com/CuteTenshii/burger-king-fr-api', Icon: Github }],
  },
];
