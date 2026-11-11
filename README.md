# Bass Assembly

A free bassline generator and step sequencer that runs in the browser. Pick a style, a root note and a scale, generate a short 8 or 16 step bass pattern, listen to it, edit every step, then reproduce it on your own gear or export it as a MIDI file.

No account, no tracking, nothing uploaded. Everything runs locally and your saved ideas stay in your browser.

## Features

- Styles: Acid, EBM, Industrial, Rolling and Dark Wave, each with its own rhythm grid, note weights, accents, ties, velocity and gate ranges
- Eight scales, from minor pentatonic to harmonic minor
- Generate a bassline (random settings and sequence), change only the notes, or vary a pattern a little. Optionally repeat the first half with small variations
- Editable piano roll with accent, tie, velocity and gate for every step
- Built-in synth: wave, filter, resonance, filter decay, drive, sub oscillator, glide, delay and reverb
- Swing and humanize (small random changes to timing, velocity and note length)
- "Play it on your gear" panel: the note of each step on a piano keyboard and on a generic two row pad layout
- Copy the pattern as text, or export it as a Standard MIDI File (1, 2 or 4 bars)
- Save the ideas you like, stored in the browser's local storage
- Dark and light themes

## Run it

It is a static site with no build step and no dependencies. Get the code with git, or download it as a ZIP from the green Code button on GitHub:

```bash
git clone https://github.com/chrislpdls/bass-assembly.git
cd bass-assembly
# any static server works
npx serve .
# or
python3 -m http.server 8000
```

Then open the address it prints. You can also open `index.html` directly in a browser, but a local server is closer to production.

## Project structure

```
index.html     page, SEO tags, structured data, content and FAQ
style.css      styles and self-hosted font declarations
app.js         generator, sequencer, Web Audio synth, MIDI export
theme.js       applies the saved light or dark theme before the first paint
fonts/         Geist, Geist Mono and Geist Pixel Line (SIL Open Font License)
favicon.svg    icon
apple-touch-icon.png  180x180 icon for iOS home screens
logo.svg       logo set in Geist Pixel Line, outlined, inlined in index.html (keep both in sync)
og.png         1200x630 image used for link previews
CNAME          custom domain for GitHub Pages
robots.txt     crawler rules
sitemap.xml    sitemap
```

## Deploy

The output directory is the repository root and there is nothing to build.

- GitHub Pages: in the repository go to Settings, Pages, choose "Deploy from a branch", then the `main` branch and the `/ (root)` folder. An empty `.nojekyll` file is included so GitHub serves the files as they are. For a custom domain, add it in the same settings page, then create the DNS records it asks for
- Cloudflare Pages or Netlify: connect the repository, leave the build command empty and set the publish directory to `/`
- Any static host works the same way

### Hosting your own copy

The files use the domain of the official site, `https://bassassembly.app`. If you host your own copy, replace it with your domain in these places:

- `index.html`: the canonical link, the Open Graph and Twitter tags, and the JSON-LD blocks
- `robots.txt`: the sitemap line
- `sitemap.xml`: the `loc` entry
- `CNAME`: used by GitHub Pages for the custom domain. Put your own domain in it, or delete it if you do not use one

A quick way to do it: search the whole project for `bassassembly.app` and replace it with your domain. Then check the link preview with a social share debugger and submit `sitemap.xml` in Google Search Console.

## How the generator works

For each step the generator draws from a per style probability grid, scaled by the density setting. Notes are picked from the chosen scale with weights by interval (root, fifth and so on) and a bias toward notes close to the previous one. Accents, ties, velocity and gate come from per style ranges. The result is a suggestion, not a rule: the idea is to get unstuck, then edit.

The MIDI file is written by hand, without libraries (format 1, 480 ticks per quarter note).

## Contributing

Issues are welcome. For larger changes, please open an issue first so we can discuss them. Ideas that would be great additions: more styles and scales, a pattern shift or reverse button, keyboard shortcuts, a share link that encodes the pattern in the URL, and translations.

## License

MIT, see [LICENSE](LICENSE). The fonts in `fonts/` keep their own license, the SIL Open Font License 1.1.
