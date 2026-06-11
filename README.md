# Cadze — Free & Open-Source DWG/DXF Viewer & Editor

A fast, lightweight desktop application for viewing and editing DWG and DXF files.
Built with [Tauri v2](https://tauri.app) (Rust) and [Pixi.js v8](https://pixijs.com) (WebGL2).

> **Cadze is NOT affiliated with, endorsed by, or sponsored by Autodesk, Inc.**
> AutoCAD® and DWG® are registered trademarks of Autodesk, Inc.

---

## Video

[![Cadze — Ücretsiz AutoCAD Alternatifi](https://img.youtube.com/vi/gMYc-pxq6xI/maxresdefault.jpg)](https://www.youtube.com/watch?v=gMYc-pxq6xI)

---

## Features

### Viewing
- Open DWG (R12–R2018) and DXF files
- WebGL2 hardware-accelerated rendering via Pixi.js
- Smooth pan (left-click drag) and zoom (mouse wheel)
- Fit-to-view on file open
- ACI 256-color table (AutoCAD Color Index) with correct color mapping
- Layer panel: show/hide and freeze/unfreeze individual layers
- Entity selection (click, Shift+click multi-select, Shift+drag selection box)
- Highlighted selection with bounding box display
- Delete selected entities (with undo)

### Multi-Tab Workflow
- Open multiple files simultaneously in separate tabs
- Switch between tabs — each tab preserves its own viewport (pan/zoom position)
- Close individual tabs without closing the application
- "+" button to open additional files

### Editing Tools
| Tool | Shortcut | Description |
|------|----------|-------------|
| TRIM | `TR` | Click a line to trim it at intersections with other lines |
| EXTEND | `EX` | Click a line end to extend it to the nearest boundary |
| OFFSET | `O` or `OF [dist]` | Create a parallel copy of a line or polyline |
| DELETE | `Del` key | Remove selected entities |

### Undo / Redo
- Full undo/redo history for all edits (TRIM, EXTEND, OFFSET, DELETE)
- `Ctrl+Z` to undo, `Ctrl+Y` / `Ctrl+Shift+Z` to redo

### Annotations
- Add text notes anchored to world coordinates
- Notes preserved per-tab, exportable with the drawing

### Internationalization
- UI language detection via i18next
- Easily extensible to additional languages

### File Formats
- **DXF** — natively parsed (dxf-parser library)
- **DWG** — converted to DXF via LibreDWG (dwg2dxf), then parsed
  - DWG binary is distributed separately in Releases (GPLv3 compliance)

---

## Installation

### Option A — Pre-built Release (Recommended)

**Step 1 — Download**
Go to the [Releases](../../releases) page and download **cadze-vX.X.X-windows-x64.zip**.

**Step 2 — Extract**
Right-click the ZIP → **Extract All** → choose a permanent folder such as `C:\Cadze`.
> Do not run `cadze.exe` directly from inside the ZIP or from a temporary location.

**Step 3 — Create a shortcut (optional)**
Right-click `cadze.exe` → **Show more options** → **Create shortcut** → move the shortcut to your Desktop.

**Step 4 — Set as default app for DWG/DXF (optional)**
Right-click any `.dwg` or `.dxf` file → **Open with** → **Choose another app** → **More apps** → **Look for another app on this PC** → browse to `cadze.exe` → check **Always use this app** → **OK**.

> Cadze automatically writes the file association to the Windows registry on first launch, so `.dwg` and `.dxf` files will already appear in the "Open with" list after running the program once.

**Requirements:** Windows 10/11 (64-bit). WebView2 Runtime is required — pre-installed on Windows 11. On Windows 10, download it from [microsoft.com/edge/webview2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) if missing.

### Option B — Build from Source

#### Prerequisites
- [Node.js](https://nodejs.org) 18+
- [Rust](https://rustup.rs) (stable toolchain)
- [Tauri CLI v2](https://tauri.app/start/prerequisites/)
- Windows 10/11 with WebView2 (pre-installed on Win11; available via Windows Update on Win10)

#### Steps

```powershell
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/cadze.git
cd cadze

# 2. Install JavaScript dependencies
npm install

# 3. Download the LibreDWG binaries (required for DWG support)
#    Place these files into src-tauri/resources/bin/:
#      - dwg2dxf.exe
#      - libredwg-0.dll
#      - libiconv-2.dll
#      - libpcre2-8-0.dll
#    Download from: https://github.com/YOUR_USERNAME/cadze/releases

# 4. Build the application
$env:PATH = "C:\Users\$env:USERNAME\.cargo\bin;" + $env:PATH
cargo tauri build --no-bundle

# 5. Run the built executable
.\src-tauri\target\release\cadze.exe
```

> **Note:** `cargo tauri build` (with bundler) requires the binaries to be present in `src-tauri/resources/bin/`. The `--no-bundle` flag skips installer generation and produces a standalone `.exe`.

#### Development Mode

```powershell
npm run tauri dev
```

---

## Usage

### Opening a File
- Drag and drop a `.dxf` or `.dwg` file onto the window, **or**
- Click **File → Open** (or press `Ctrl+O`)

### Navigation
| Action | Input |
|--------|-------|
| Pan | Left-click drag |
| Zoom | Mouse wheel |
| Fit to view | `Ctrl+Shift+H` or **View → Fit** |

### Layer Control
- Click the **Layers** panel on the left to show/hide layers
- Right-click a layer to freeze/unfreeze it

### Editing
1. Select a tool from the toolbar or type a command in the command bar (bottom)
2. **TRIM (`TR`)**: Click the portion of a line to remove between its intersections
3. **EXTEND (`EX`)**: Click near the end of a line to stretch it to the nearest boundary
4. **OFFSET (`O [distance]`)**: Click a line to create a parallel copy. Specify distance with `OF 50` (e.g., 50 units)
5. Press `Esc` to cancel the current tool and return to selection mode

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Ctrl+O` | Open file |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Del` | Delete selected |
| `Ctrl+A` | Select all |
| `Esc` | Cancel / deselect |
| `TR` + Enter | Activate TRIM tool |
| `EX` + Enter | Activate EXTEND tool |
| `O` + Enter | Activate OFFSET tool |

---

## Project Structure

```
cadze/
├── src/                    # TypeScript frontend
│   ├── main.ts             # App entry point
│   ├── workspace.ts        # File management, tools, undo/redo
│   ├── renderer.ts         # Pixi.js WebGL2 renderer & input handling
│   ├── geo.ts              # Computational geometry (TRIM/EXTEND/OFFSET math)
│   ├── dxf-loader.ts       # DXF parsing and entity extraction
│   ├── colors.ts           # ACI 256-color table
│   └── styles.css          # Application styles
├── src-tauri/              # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs
│   │   └── lib.rs          # Tauri commands, DWG→DXF conversion
│   ├── resources/bin/      # Third-party binaries (NOT in repo — see Releases)
│   └── tauri.conf.json
├── LICENSE                 # MIT License
└── THIRD-PARTY-NOTICES.txt # Third-party licenses
```

---

## Legal Notices

### Trademark Disclaimer
Cadze is an **independent open-source project** and is **not affiliated with, endorsed by, or sponsored by Autodesk, Inc.** in any way. AutoCAD®, DWG®, and DXF® are registered trademarks of Autodesk, Inc. Cadze implements its own DXF parser and uses LibreDWG (a separate process) solely for file format interoperability.

### Third-Party Software

| Component | License | Purpose |
|-----------|---------|---------|
| [LibreDWG](https://www.gnu.org/software/libredwg/) | GPLv3 | DWG→DXF conversion (separate process) |
| [Pixi.js](https://pixijs.com) | MIT | WebGL2 rendering engine |
| [dxf-parser](https://github.com/gdsestimating/dxf-parser) | MIT | DXF file parsing |
| [i18next](https://www.i18next.com) | MIT | Internationalization |
| [Tauri](https://tauri.app) | MIT / Apache-2.0 | Desktop application framework |
| [Vite](https://vitejs.dev) | MIT | Build tool |

LibreDWG is used as an **independent, arm's-length subprocess** (`dwg2dxf.exe`). Cadze communicates with it only via command-line arguments and reads the resulting file. This usage model keeps Cadze's own MIT-licensed codebase independent of GPLv3 obligations. The LibreDWG binary and its source code are available at [gnu.org/software/libredwg](https://www.gnu.org/software/libredwg/).

### SHX Fonts
Cadze does **not** include or distribute any SHX font files owned by Autodesk (simplex.shx, romans.shx, etc.). Missing fonts are substituted with open-source alternatives and the user is notified.

---

## License

Cadze is released under the [MIT License](LICENSE).

Copyright (c) 2025 Sedat Telli
