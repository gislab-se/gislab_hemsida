# GISLab – webbplats

Källkod och publicerade resurser för [gislab.se](https://gislab.se/), GISLabs webbplats och laboratorium för geografiska analyser och interaktiva prototyper.

## Publika delar

- [Svensk startsida](https://gislab.se/)
- [English start page](https://gislab.se/en/)
- [Labbet](https://gislab.se/lab/)
- [Stockholm × Torsboda](https://gislab.se/lab/stockholm-torsboda/)
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


## Stockholm × Torsboda

`lab/stockholm-torsboda/` är den fristående kartan, publicerad direkt på GISLab.
Kortet Digitala verktyg på svenska och engelska startsidan samt projektkortet i Labbet länkar hit.
Appen använder relativa sökvägar för sin worker, kartlager, 100-metersrutor, typsnitt och ljudkod.
Kartans ursprung är `C:/gislab/projekt/datacenter/stockholm-3d/dist`, källversion
`b0ac2d6bd1d9ae5c2b30f36c8885a95d486851b9`. Uppdateringar kopieras från den katalogen;
bevara GISLabs canonical/OG-adress och tillbaka-länk i appens index.html.
Publicera inte `.openai/`, `.git`, arbetsfiler eller inloggningsuppgifter tillsammans med appen.
Scenariot visar antaganden och är ingen prognos för strömavbrott. Befolkningsrutorna är originalets 100 × 100 meter.
