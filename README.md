# GISLab – webbplats

Källkod och publicerade resurser för [gislab.se](https://gislab.se/), GISLabs webbplats och laboratorium för geografiska analyser och interaktiva prototyper.

## Publika delar

- [Svensk startsida](https://gislab.se/)
- [English start page](https://gislab.se/en/)
- [Labbet](https://gislab.se/lab/)
- [Regionkartan – Greater Copenhagen (pågående projekt)](https://gislab.se/lab/regionkarta/)
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

## Integritet och kakor

Se [PRIVACY_REVIEW.md](PRIVACY_REVIEW.md) för inventering, lagkrav och kvarstående integritetsarbete samt [PRIVACY_LIVE_REVIEW.md](PRIVACY_LIVE_REVIEW.md) för kontrollen av verkliga cookies och nätverksanrop efter publicering. Integritetssidorna i `integritet/` och `en/privacy/` är fortfarande utkast. Externa kartbakgrunder är av tills besökaren väljer dem; planteringsplaner sparas och läses endast med uttryckliga knapptryck. Kör `node --test tests/privacy.test.cjs` efter ändringar i externa resurser och bevara integritetsanpassningarna när färdigbyggda appar uppdateras.

## Lokal förhandsvisning

Webbplatsen är statisk. Starta en enkel lokal webbserver i repo-roten, exempelvis:

```bash
python -m http.server 8000
```

Öppna sedan `http://localhost:8000/`. Använd en lokal webbserver i stället för att öppna HTML-filerna direkt, eftersom vissa resurser använder absoluta eller relativa webbvägar.

## Publicering

Repo:t publiceras via GitHub Pages med den anpassade domänen `gislab.se`. Kontrollera att interna länkar och publika appar fungerar innan ändringar förs till `main`.

## Söksynlighet

Startsidorna har svenska respektive engelska titlar, beskrivningar och ömsesidiga `hreflang`-länkar. Svenska sidan beskriver den lokala basen i Simrishamn på Österlen; båda sidorna välkomnar internationella uppdrag. Uppdatera titel, beskrivning och motsvarande Open Graph/Twitter-fält tillsammans.

`sitemap.xml` listar de publika sidor som ska kunna indexeras. Lägg till nya projektsidor där och ändra `lastmod` när sidans innehåll ändras. Behåll omdirigeringen `/klimatinitiativet/` utanför sidkartan. Regionkartans presentation ligger publikt på `/lab/regionkarta/`; den externa prototypen kräver för närvarande ChatGPT-inloggning.

Efter publicering: skicka `https://gislab.se/sitemap.xml` i Google Search Console, använd webbadressgranskning för ändrade sidor och begär indexering. Domänverifiering och begäran om indexering kräver tillgång till rätt Search Console-egendom. Följ sökfrågor, länder, exponeringar och klick i resultatrapporten.


## Stockholm × Torsboda

`lab/stockholm-torsboda/` är den fristående kartan, publicerad direkt på GISLab.
Kortet Digitala verktyg på svenska och engelska startsidan samt projektkortet i Labbet länkar hit.
Appen använder relativa sökvägar för sin worker, kartlager, 100-metersrutor, typsnitt och ljudkod.
Kartans ursprung är `C:/gislab/projekt/datacenter/stockholm-3d/dist`, källversion
`b0ac2d6bd1d9ae5c2b30f36c8885a95d486851b9`. Uppdateringar kopieras från den katalogen;
bevara GISLabs canonical/OG-adress och tillbaka-länk i appens index.html.
Publicera inte `.openai/`, `.git`, arbetsfiler eller inloggningsuppgifter tillsammans med appen.
Scenariot visar antaganden och är ingen prognos för strömavbrott. Befolkningsrutorna är originalets 100 × 100 meter.

## Klimatverkstad

`klimatverkstad/` byggs från `gislab-se/klimatverkstad` med
`VITE_BASE_PATH=/klimatverkstad/`. Publiceringen 2026-11-03 använder källversion
`421e2f98c4050d1ad202602c52f65d0c1b8f8aee` och lägger till kommunens 402
fastigheter, markfördelning i Mat 04 och ett tänd/släckbart marklager i Vindkraft 01.
Markfördelningen kombinerar NMD2023 v2.1 med jordbruksblock från 2025;
metod och källmetadata finns i `klimatverkstad/data/food/landcover-summary.json`.

Appbygget innehåller `privacy-controls.js` och `privacy-controls.css`, baserade
på webbplatsens gemensamma kontroller. Uppdateringen 2026-11-04 från källversion
`835a910` visar en stor dialog vid första besöket och sparar ja eller nej i
180 dagar. Externa kartbilder hämtas först efter ett aktivt ja eller ett
giltigt tidigare ja. Kartinställningar öppnar samma dialog för att ändra valet.
De svenska och engelska integritetssidorna beskriver den lokala lagringen.
Appen laddar inga externa typsnitt. Produktionsbygget och webbläsartester av
första besök, sparade val, återkallelse, utgångna och felaktiga val,
blockerad lagring, tangentbordsåtkomst och mobilvy har kontrollerats.
