# Folio CV Builder

A CV builder that runs entirely in the browser. Pick a template, fill in your details, watch the live A4 preview, then download your CV. It's plain HTML, CSS and JavaScript, so there's no build step and no server code. Any static host will serve it.

## Features

- **4 templates:** Meridian (classic serif), Ledger (colour sidebar with photo), Signal (bold modern), Plain (ATS-friendly)
- **Accent colour:** pick a preset or any custom colour
- **Sections:** personal details, photo, profile summary, experience, education, skills, languages, certifications
- **Entries:** add, remove and reorder experience and education entries
- **Live preview:** A4 preview with page-break markers
- **Exports**
  - **Download PDF**: one click (image-based PDF)
  - **Print**: opens the browser's print dialog. Choose *Save as PDF* to get a PDF with selectable text, which is best for job portals.
  - **Download HTML**: a standalone copy of your CV
  - **Save data / Load data**: keep your details in a `.json` file and edit them later
- **Autosave:** your draft is saved in the browser automatically
- **Works on phones:** Edit/Preview toggle on small screens, plus dark mode for the editor

## Project structure

```
cv-builder/
├── index.html          Page markup
├── css/
│   ├── app.css         Editor/app styles
│   └── templates.css   CV template styles (one block per template)
├── js/
│   ├── templates.js    Template definitions and HTML renderers
│   └── app.js          State, form, live preview, exports
└── README.md
```

## Run it locally

You can open `index.html` directly in a browser. Everything works except **Download HTML**, which some browsers block for files opened from disk. To run it through a local web server instead, use one of these:

- **VS Code:** install the *Live Server* extension, right-click `index.html` and choose **Open with Live Server**.
- **Node.js:** in this folder, run `npx serve .` and open the address it prints.
- **Python:** in this folder, run `python -m http.server 8000` and open http://localhost:8000.

## Deploy

Because it's a static site, any of these work:

### Netlify (easiest)
1. Go to https://app.netlify.com/drop
2. Drag the whole `cv-builder` folder onto the page. You get a live URL straight away.

### GitHub Pages
1. Create a new GitHub repository and push this folder to it:
   ```bash
   git init
   git add .
   git commit -m "Folio CV Builder"
   git branch -M main
   git remote add origin https://github.com/<your-username>/cv-builder.git
   git push -u origin main
   ```
2. In the repository, go to **Settings → Pages**, set *Source* to **Deploy from a branch**, pick `main` and `/ (root)`, then save.
3. Your site will be at `https://<your-username>.github.io/cv-builder/`.

### Vercel
1. Push the folder to GitHub (as above).
2. On https://vercel.com, choose **Add New → Project**, import the repository, and leave the framework preset as **Other**. No build command is needed.

## Adding a template

1. In `js/templates.js`, add `{ id: "mytemplate", name: "My Template", desc: "…" }` to `TEMPLATES`.
2. In the same file, add a `mytemplate: function (d) { … return html; }` renderer to `render`. Copy an existing one as a starting point.
3. In `css/templates.css`, add styles scoped to `.t-mytemplate`.

Add the `keep` class to any block that shouldn't be split across pages.

## External libraries (loaded from CDN)

- [html2canvas 1.4.1](https://html2canvas.hertzen.com/) and [jsPDF 2.5.1](https://github.com/parallax/jsPDF) for the PDF download
- Google Fonts: Bricolage Grotesque, Figtree, Source Serif 4, Manrope, IBM Plex Sans

## Privacy

All data stays in the user's browser (localStorage). Nothing is sent to a server.
