# Pikchr Editor

[English](README_EN.md) | [한국어](README.md)

A visual web editor designed for interactively previewing, creating, and modifying the Pikchr markup language.
This project was generated and developed using Google Antigravity.

## 1. Overview & Purpose

When authoring Pikchr (a PIC-derived markup language for diagrams) scripts, this tool provides synchronized live rendering, direct code editing, and a visual property inspector to rapidly design and customize diagrams.

## 2. Operating Environment (OS Compatibility)

- Verified Environment: Linux (Ubuntu ARM64 / aarch64)
- Note: This project has not been tested on other operating systems or architectures such as macOS, Windows, or x86_64.

## 3. Web UI Architecture & Layout

```
+-----------------------------------------------------------------------------------+
| Top Menu Bar: Brand, File, Edit, Examples, View, Help, Lang, Theme, Status, Export|
+--------------------+------------------------------------+-------------------------+
| Left Sidebar       | Center Stage                       | Right Sidebar           |
| (Palette & Defs)   | (Interactive Canvas)               | (STATEMENTS & PROPERTY) |
|                    |                                    |                         |
| - Basic Shapes     | - Real-time SVG Rendering          | [STATEMENTS]            |
|   (Box, Circle...) | - Pan & Zoom Navigation            | - Object Statement List |
| - Snippets         | - Object Selection                 |                         |
| - Variables        | - Anchor Point Picker              | [PROPERTY]              |
|                    |                                    | - Shape Properties      |
|                    |                                    | - Connector Segments    |
+--------------------+------------------------------------+-------------------------+
| Bottom Panel: Code Editor (code view)                                             |
| - Textarea/Editor with Line Numbers, Live Syntax Check, Compile Status             |
+-----------------------------------------------------------------------------------+
```

### Component Details

1. **Top Menu Bar**
   - File operations (New, Copy Source Code, Export SVG/PNG)
   - Edit (Undo, Redo, Clear Canvas), Template Examples, Language Selector (KO/EN/JA), Theme Toggle (Dark/Light)
2. **Left Palette Sidebar**
   - One-click insertion for basic objects (box, circle, cylinder, diamond, ellipse, file, etc.) and snippets
   - List of defined variables and macros (`define`)
3. **Center Stage (Interactive Canvas)**
   - Real-time SVG rendering from Pikchr script
   - Pan (drag) and Zoom (mouse wheel) navigation
   - Element selection with automatic focus synchronization in code editor and inspector
   - Interactive anchor point picker for connector target positioning
4. **Right Sidebar (STATEMENTS & PROPERTY)**
   - **STATEMENTS**: Parsed statement (object) list tree with selection synchronization
   - **PROPERTY**: Form-based inspector for labels, dimensions, colors, placement (`at`, `with`), and multi-segment connector paths (`from`, `to`, `until`)
5. **Bottom Panel (Code Editor - code view)**
   - Source code editing with line numbers
   - Real-time syntax validation, line error indicators, and compilation benchmarks

## 4. How to Use

1. **Add Shapes**: Click any object or snippet from the Left Palette to append it to the canvas.
2. **Edit Properties**: Select an object on the canvas or from the STATEMENTS list, then modify dimensions, colors, or text in the PROPERTY inspector.
3. **Configure Connectors & Paths**:
   - Select an arrow/line object and click `+ Add Segment (then)` to configure sequential steps (Direction, Length, To, Until).
   - Enable Target Mode to pick anchor points directly on the canvas.
4. **Direct Code Editing**: Write or tweak Pikchr markup directly in the bottom `code view` with immediate canvas and inspector synchronization.
5. **Export & Copy**: Use `File` -> `Export SVG` or `Export PNG` to download graphics, or use `Copy Source Code` to copy the entire code to the clipboard.

## 5. Installation & Execution

### Prerequisites
- Node.js (v18 or higher recommended)
- npm (v9 or higher recommended)

### Install Dependencies
```bash
npm install
```

### Run Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000`.

### Production Build
```bash
npm run build
```
Build artifacts will be output to the `dist/` directory.

## 6. License

This project is licensed under the [MIT License](LICENSE).
