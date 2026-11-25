<div align="center">

<img src="public/logo.png" width="80" height="80" alt="Foleyo Logo" />

# Foleyo

**Turn any folder of downloaded videos into a clean, local course player.**

No uploads. No account. No backend.  
Your videos stream straight from your disk in your browser.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## ✨ What is Foleyo?

Foleyo is a local-first web app that turns a folder of downloaded course videos on your computer into a structured learning interface — modules, lessons, subtitles, notes, and progress tracking — without uploading a single file anywhere.

Point it at a folder on macOS, Windows, or Linux, and Foleyo reads the folder directly using the browser's File System Access API.

### Why I built it

- **No more clicking through folders** in Finder or Explorer trying to remember which video you watched last
- **Split-screen friendly** — press `F` to fill just your browser window (so you can keep your code editor or notes open on the other half of your screen)
- **Private by design** — videos, notes, and progress stay on your machine
- **Works offline** — play local files without internet once the app is open (or self-host it locally with `npm run dev`)

---

## 🎯 Features

| Feature | What it actually does |
|---|---|
| 📁 **Direct Folder Access** | Pick any local course folder via the browser's native picker — nothing is copied or uploaded |
| 🗂️ **Smart Folder Parsing** | Recursively maps subfolders to modules and video files to lessons, sorted naturally by numeric prefix (`01_`, `2_`, `10_`) |
| 🎬 **Split-Screen Ready Player** | Built on [Vidstack](https://vidstack.io) with speed persistence, Picture-in-Picture, **Fill Window** fullscreen (`F`) for split-screen study, and **Monitor Fullscreen** (`Shift+F`) |
| 📊 **Progress & Resume** | Saves playback position as you watch, marks finished lessons complete, and resumes where you left off |
| ▶️ **Autoplay with Countdown** | Automatically advances to the next lesson after a 5-second cancelable countdown (`Esc` or Cancel) |
| 💬 **Automatic Subtitles** | Auto-detects matching `.srt` and `.vtt` files next to each video (including language codes like `01_Intro.en.srt`), converting `.srt` to WebVTT on the fly |
| 📝 **Per-Lesson Notes & Export** | Auto-saving notes under each video, with one-click export of all course notes to a single `.md` file |
| 🔍 **Sidebar Search & Refresh** | Filter modules/lessons by title, and refresh a course folder in place if you download new lessons later |
| ⏱️ **Watch Time & Completion Stats** | Shows completed lessons, percentage, watched duration, and remaining time in the header |
| 📚 **Recent Courses Library** | Remembers previously opened courses (with a thumbnail from the first lesson) so you can resume in one click |
| 🌙 **Dark & Light Mode** | Respects your system preference by default and remembers your toggle |
| 📲 **Installable (PWA Manifest)** | Can be installed as a standalone desktop window in Chromium browsers |

---

## 📂 How Folders Are Parsed

```text
Complete_Web_Dev/
├── 01_HTML_Basics/
│   ├── 01_Intro.mp4
│   ├── 01_Intro.en.srt       # Auto-loaded as English subtitles
│   └── notes.pdf             # Ignored (non-video / non-subtitle)
├── 02_CSS_Styling/
│   ├── 01_Flexbox.mp4
│   └── 02_Grid.webm
└── 03_Bonus/
    └── 01_Tips/
        └── 01_Shortcuts.mp4  # Nested subfolders become "Bonus - Tips"
```

- **Subfolders** become modules (nested folders are joined like `Parent - Child`; hidden folders starting with `.` are skipped)
- **Videos directly in the root folder** are grouped under a `"Course Content"` module
- **Leading numbers** (`01_`, `02-`, `10. `) control sort order and are stripped from display titles

---

## 🎞️ Supported & Unsupported Formats

Because Foleyo plays files directly in your browser's `<video>` element (with no server-side transcoding), format support is determined by what Chromium can natively demux and decode:

| Format | Status | Notes |
|---|---|---|
| `.mp4`, `.m4v` (H.264 / AAC) | ✅ **Best support** | Plays reliably everywhere |
| `.webm` (VP8 / VP9 / AV1) | ✅ **Supported** | Plays natively in Chromium |
| `.ogv` | ✅ **Supported** | Plays natively in Chromium |
| `.mkv`, `.mov` | ⚠️ **Depends on codec** | Plays if encoded with H.264/AAC (or VP9/Opus). May fail or play without audio if it uses **H.265/HEVC** (hardware-dependent), **Dolby Digital (AC-3 / EAC-3)**, **DTS**, or **Apple ProRes** |
| `.ts` (MPEG-TS), `.avi`, `.wmv`, `.flv`, `.mpg`, `.mpeg`, `.vob`, `.3gp` | ❌ **Not supported** | Chromium's `<video>` element cannot play these containers natively; they are skipped when scanning |
| `.srt`, `.vtt` (Subtitles) | ✅ **Supported** | `.srt` is converted to WebVTT on the fly; if both exist for the same language, `.vtt` is preferred |

> **Tip:** If you have `.ts` files with H.264/AAC, you can remux them to `.mp4` instantly without re-encoding:
> ```bash
> ffmpeg -i input.ts -c copy output.mp4
> ```
> For `.avi`, `.wmv`, `.flv`, or unsupported codecs inside `.mkv`/`.mov`, re-encode to H.264/AAC MP4:
> ```bash
> ffmpeg -i input.mkv -c:v libx264 -c:a aac output.mp4
> ```

---

## ⌨️ Keyboard Shortcuts

When the video player has focus:

| Key | Action |
|---|---|
| `Space` / `K` | Play / Pause |
| `←` / `→` or `J` / `L` | Seek backward / forward |
| `↑` / `↓` | Volume up / down |
| `F` | Toggle **Fill Window** (fills only the browser viewport — great for split-screen) |
| `Shift + F` | Toggle **Monitor Fullscreen** (native full display) |
| `M` | Mute / unmute |
| `C` | Toggle captions |
| `I` | Toggle Picture-in-Picture |
| `<` / `>` | Playback speed down / up |
| `Esc` | Unwinds layers: cancel auto-advance → exit fill window → back to library |

---

## 🚀 Getting Started (Run Locally)

### Prerequisites

- **Node.js** `20.9+`
- A desktop **Chromium browser** — Chrome, Edge, Brave, or Arc (required for the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API))

### Install & Run

```bash
# Clone the repo
git clone https://github.com/rafiqulshopon/foleyo.git
cd foleyo

# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge.

### Production Build

```bash
npm run build
npm start
```

### Checks & Tests

```bash
npm run typecheck   # TypeScript check (tsc --noEmit)
npm run lint        # ESLint
npm test            # Vitest unit tests
```

---

## 🔒 Privacy & Local Data

- **Zero file uploads**: Videos and subtitles are read directly from disk via browser `FileSystemFileHandle` objects.
- **Local persistence**:
  - Recent course folder handles, cached course trees, and generated thumbnails are stored in your browser's **IndexedDB**.
  - Playback progress, lesson notes, playback speed, caption preference, and theme are stored in **localStorage**.
- **No accounts or cloud sync**: Data stays tied to the browser profile you use (clearing site data will clear saved progress and notes — export your `.md` notes if you want a backup).
- **Analytics**: The hosted deployment includes `@vercel/analytics` for basic page views only; no course names, filenames, or notes are sent.

---

## ⚠️ Honest Limitations

Before you dive in, here's what Foleyo **doesn't** do (or where browser limits apply):

- **Chromium desktop browsers only**: Firefox, Safari, and mobile browsers do not support the full File System Access API (`showDirectoryPicker`), so Foleyo won't work there.
- **Re-granting folder permission**: Browsers reset disk permissions across sessions, so when you reopen a recent course you'll get a one-click browser prompt to re-allow read access to that folder.
- **Browser video format limits**: Because playback happens directly in Chromium with no backend transcoding, not all video containers/codecs work (see [Supported & Unsupported Formats](#-supported--unsupported-formats) above).
- **Cold-offline hosted loading**: Foleyo includes a PWA manifest so you can install it as an app window, but it does **not** ship a service worker yet. Once open it plays local videos offline, or you can run it locally (`npm start`) for 100% offline access anytime.
- **No cloud sync**: Progress and notes live in your current browser only.
- **Very large folders**: Courses with hundreds of videos may take a few seconds to scan on first open.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| [Next.js 16](https://nextjs.org) & [React 19](https://react.dev) | App shell and UI |
| [TypeScript 5](https://typescriptlang.org) | Type safety |
| [Tailwind CSS 4](https://tailwindcss.com) | Styling & dark/light theme tokens |
| [Vidstack](https://vidstack.io) | Video player & customizable controls |
| [idb-keyval](https://github.com/jakearchibald/idb-keyval) | IndexedDB storage for folder handles & cache |
| [Vitest](https://vitest.dev) & Testing Library | Unit tests |

---

## 📁 Project Structure

```text
foleyo/
├── app/
│   ├── components/
│   │   ├── header.tsx                 # Top bar: progress, watch time, autoplay, theme
│   │   ├── sidebar.tsx                # Collapsible module/lesson tree, search, refresh
│   │   ├── video-player.tsx           # Vidstack player, fill-window fullscreen, notes
│   │   ├── video-player-wrapper.tsx   # Client-only dynamic wrapper (ssr: false)
│   │   ├── welcome-screen.tsx         # Folder picker, recent library, quick reference
│   │   ├── error-alert.tsx            # Inline error banner
│   │   └── focus-ring.ts              # Shared accessible focus styles
│   ├── context/
│   │   ├── __tests__/                 # Tests for Escape / history layering
│   │   ├── course-context.tsx         # Course state, navigation, autoplay, fullscreen
│   │   ├── lesson-durations-context.tsx # Background duration state for watch stats
│   │   ├── theme-context.tsx          # Dark / light theme state
│   │   ├── use-course-history.ts      # Browser back & Escape-key layer handling
│   │   ├── use-duration-scanner.ts    # Background video duration scanner
│   │   └── use-video-loader.ts        # Blob URL & subtitle lifecycle
│   ├── lib/
│   │   ├── __tests__/                 # Vitest suites (parsing, progress, subtitles, notes)
│   │   ├── parse-course.ts            # Recursive folder → Course parser
│   │   ├── progress-store.ts          # localStorage progress & watch-time stats
│   │   ├── recent-courses-store.ts    # IndexedDB handles, cache & library metadata
│   │   ├── subtitles.ts               # SRT → WebVTT conversion & track deduplication
│   │   ├── thumbnail-generator.ts     # First-lesson canvas thumbnail generator
│   │   └── use-notes.ts               # Auto-saving per-lesson notes hook
│   ├── types/
│   │   └── file-system.d.ts           # File System Access API TypeScript definitions
│   ├── types.ts                       # Core types & codec-risk helpers
│   ├── globals.css                    # Theme variables, animations, player overrides
│   ├── layout.tsx                     # Root layout, fonts & metadata
│   ├── manifest.ts                    # PWA manifest
│   └── page.tsx                       # App entry & browser capability check
├── public/                            # Logo & PWA icons
├── next.config.ts                     # Security headers
├── vitest.config.ts                   # Test runner config
└── package.json
```

---

## 🤝 Contributing

Contributions, bug reports, and ideas are welcome!

1. Fork & clone the repository, then run `npm install`
2. Create a branch: `git checkout -b feature/your-feature`
3. Follow the existing conventions:
   - Use CSS theme tokens from `app/globals.css` (test in both dark and light mode)
   - Keep everything client-side — no backend dependencies
4. Verify before opening a PR:
   ```bash
   npm run typecheck && npm run lint && npm test
   ```
5. Open a PR describing what changed and why (screenshots are always helpful for UI changes)

### Good Ideas to Contribute

- 📴 Service worker for true cold-offline PWA loading
- 💾 Export/import backup for progress and notes across browsers
- 🎨 Custom accent colors / themes
- 🎧 Audio-only / podcast-style playback mode

---

## 📄 License

Licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built for learners who want a calm, private way to watch local courses.**

[Report Bug](https://github.com/rafiqulshopon/foleyo/issues) · [Request Feature](https://github.com/rafiqulshopon/foleyo/issues)

</div>
