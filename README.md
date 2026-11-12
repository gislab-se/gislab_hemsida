# GISLab – webbplats

Källkod och publicerade resurser för [gislab.se](https://gislab.se/), GISLabs webbplats och laboratorium för geografiska analyser och interaktiva prototyper.

## Publika delar

- [Svensk startsida](https://gislab.se/)
- [English start page](https://gislab.se/en/)
- [Labbet](https://gislab.se/lab/)
- [Stiftslab – kyrkans geografi](https://gislab.se/lab/stiftslab/)
- [Stiftslab – kyrkans geografi](https://gislab.se/lab/stiftslab/)
- [Örebro i Sälenfjällen](https://gislab.se/lab/orebro-i-salenfjallen/)
- [Regionkartan – Greater Copenhagen (pågående projekt)](https://gislab.se/lab/regionkarta/)
- [Stockholm × Torsboda](https://gislab.se/lab/stockholm-torsboda/)
- [Havsnivå och klimatanpassning](https://gislab.se/lab/havsniva-klimatanpassning/)
- [Sälenfjällen i 3D](https://gislab.se/lab/salenfjallen-3d/)
- [En natt i Sälenfjällen – besöksscenarier och fastboende](https://gislab.se/lab/besoksscenarier/)
- [Vattenförbrukning i Vättern](https://gislab.se/lab/vattenforbrukning/)

## Struktur

`lab/stiftslab/` är den statiska appen från `C:/gislab/projekt/kyrkan/stiftslab/dist`.
Den publicerades 2026-11-12 med alla stifts gränser, SCB-folkmängd och Lunds
fördjupade planeringsunderlag. Kyrko-/begravningsplatslagret och de dokumenterade
fastighetskopplingarna är uttryckligen ofullständiga. Appen använder den gemensamma
kartdialogen, lokala resurser och lokal IndexedDB för scenarier. Externa OSM-bilder
aktiveras först efter besökarens val. Inga privata arbetsutkast, råa PDF-filer,
inloggningsuppgifter eller `.openai`-filer följer med publiceringen.
Verifierat inför publicering: 22 app-/datatester, fyra beteckningstester,
oberoende kontroll av 12 fastigheter/29 skiften, webbplatsens fem integritetstester
och HTTP-leverans av app, workers, JSON/GeoJSON och rasterbinär under rätt sökväg.
Visuell webbläsargranskning återstår på grund av otillgänglig preview-infrastruktur.

`lab/stiftslab/` är den statiska appen från `C:/gislab/projekt/kyrkan/stiftslab/dist`.
Den publicerades 2026-11-12 med alla stifts gränser, SCB-folkmängd och Lunds
fördjupade planeringsunderlag. Kyrko-/begravningsplatslagret och de dokumenterade
fastighetskopplingarna är uttryckligen ofullständiga. Appen använder den gemensamma
kartdialogen, lokala resurser och lokal IndexedDB för scenarier. Externa OSM-bilder
aktiveras först efter besökarens val. Inga privata arbetsutkast, råa PDF-filer,
inloggningsuppgifter eller `.openai`-filer följer med publiceringen.

`lab/besoksscenarier/` är byggt från `C:/gislab/projekt/dalarna/besoksscenarier`.
Det jämför hypotetiska övernattande besökare med WorldPop Global2 2025,
anpassat till bostadsbyggnader på ett gemensamt 100-metersrutnät. Befolkningen
är modellerad, inte faktisk folkbokföring. Appen använder paketerade data
och lokala resurser; inga externa kartbilder, typsnitt eller analysanrop laddas.
Uppdatera med innehållet i projektets `dist/` och behåll canonical-adressen,
källhänvisningarna och länken tillbaka till Labbet.

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


## Agroforestry: laserdata och utjämnade trädrader

Versionen 2026-11-04 bygger på källversion `96b6fc7` i kartprojektet. Markmodellen
har 1 m rutstorlek och bygger på Lantmäteriets laserdata från februari 2025.
Lagerpanelen styr gräns, höjdkurvor, skuggning, trädrader och trädpunkter. Fyra
utjämningsnivåer formar både kurvor och planteringsrader; kurvornas ekvidistans
är separat från planteringsavståndet. Grundytan behåller 1 054 träd och 3 m fri kant.
GeoJSON-export och sparade planer följer vald utjämning. Originalets höjduppslag
och webbplatsens kartval bevaras. Fastighetsidentifierare är borttagna från den
publika sidan och exporter, medan läge och geometri fortsatt är publika.

Publiceringskontrollen omfattar alla fyra utjämningsnivåer, nedladdningar,
sparade planer, mobilvy samt webbplatsens tester för kartval och externa resurser.
Den färdiga kartan ligger i `lab/agroforestry/`, inklusive lokala kopior av
`map-consent.js` och `map-consent.css`.

## Gemensamma kartval

Stockholm × Torsboda och Agroforestry använder `scripts/map-consent.js` och `assets/map-consent.css`. Första besöket visar en dialog; ja och nej sparas i 180 dagar, avgränsat till verktyg, leverantör och informationsversion. Se [inventering och verifiering](MAP_CONSENT_REVIEW.md).

Källprojekten synkroniseras utan att publicera eller committa deras övriga ändringar:

```powershell
node scripts/sync-map-consent.cjs C:/gislab/projekt/datacenter/stockholm-3d C:/gislab/projekt/experimentella_geografier/Anderslov
```

Skriptet uppdaterar Stockholms `dist` samt Agroforestrys mall, kartkod och publiceringsskript. Båda får lokala kopior av gemensam JS/CSS. Agroforestrys publicering kopierar resurserna med HTML-filen och aktiverar aldrig satellitbild automatiskt. Lägg till nya leverantörer uttryckligen och höj informationsversionen när mottagare, syfte eller information ändras.

Webbläsartester (installerad Playwright och Chrome):

```powershell
$env:PLAYWRIGHT_MODULE="C:/path/to/node_modules/playwright"
$env:MAP_TEST_ORIGIN="http://127.0.0.1:8876"
node tests/map-consent.browser.cjs
```

`MAP_TEST_OUTPUT` anger katalog för rapport och skärmbilder. `MAP_TEST_LIVE=1` använder verkliga kartbilder utan avlyssnade eller ersatta svar. Kör även `node --test tests/privacy.test.cjs`. Publicering sker som tidigare via main och GitHub Pages.

## Örebro i Sälenfjällen

`lab/orebro-i-salenfjallen/` är den statiska GISlab-publiceringen av `C:/gislab/projekt/dalarna/besoksscenarier/sites/orebro`. Kortet Kartanalys på svenska startsidan och projektkatalogen i Labbet länkar hit. Bygg från källprojektet och kopiera endast `dist/`; bevara relativa resurssökvägar och GISlabs canonical-adress. Samma app har en separat Sites-publicering.

Appen jämför WorldPop 2026 i Örebro med 100 000 hypotetiska nattbesökare i Sälen samt GTFS Regional för 9 november–12 december 2026 (periodgenomsnitt, inte årsgenomsnitt). All data och alla kartresurser ligger lokalt; inga nycklar eller råa personpunkter publiceras. Källdata, avgränsningar, metod och trafiktäckning beskrivs i appen och dess JSON-exporter.
