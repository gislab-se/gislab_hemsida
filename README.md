# GISLab – webbplats

Källkod och publicerade resurser för [gislab.se](https://gislab.se/), GISLabs webbplats och laboratorium för geografiska analyser och interaktiva prototyper.

## Publika delar

- [Svensk startsida](https://gislab.se/)
- [English start page](https://gislab.se/en/)
- [Labbet](https://gislab.se/lab/)
- [Havsnivå och klimatanpassning](https://gislab.se/lab/havsniva-klimatanpassning/)
- [Sälenfjällen i 3D](https://gislab.se/lab/salenfjallen-3d/)
- [Vattenförbrukning i Vättern](https://gislab.se/lab/vattenforbrukning/)

## Struktur

- `index.html` och `en/index.html` är webbplatsens svenska och engelska startsidor.
- `lab/` innehåller de publicerade labbprototyperna.
- `scripts/lab-projects.js` är katalogen över projekt som visas i Labbet.
- `assets/`, `scripts/` och `styles.css` innehåller gemensamma resurser.
- `CNAME`, `robots.txt` och `sitemap.xml` styr den publika GitHub Pages-webbplatsen.

## Lokal förhandsvisning

Webbplatsen är statisk. Starta en enkel lokal webbserver i repo-roten, exempelvis:

```bash
python -m http.server 8000
```

Öppna sedan `http://localhost:8000/`. Använd en lokal webbserver i stället för att öppna HTML-filerna direkt, eftersom vissa resurser använder absoluta eller relativa webbvägar.

## Publicering

Repo:t publiceras via GitHub Pages med den anpassade domänen `gislab.se`. Kontrollera att interna länkar och publika appar fungerar innan ändringar förs till `main`.

