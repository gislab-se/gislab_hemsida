# Kartbakgrunder och sparade val

Datum: 2026-11-04. Referens: Klimatverkstad i webbplatsens commit `15fab54`.

## Inventering

Inventeringen omfattar samtliga kartverktyg som levereras från gislab.se, utifrån HTML-filerna, Labbet-katalogen, sidkartan, klientkoden och webbläsarens nätverksanrop.

| Verktyg och publicerad adress | Kartresurser och mottagare | Åtgärd |
| --- | --- | --- |
| [Stockholm × Torsboda](https://gislab.se/lab/stockholm-torsboda/) | Lokala befolkningsdata; valbar rasterbakgrund från OpenStreetMap Foundation, `tile.openstreetmap.org` | Ny dialog, sparat ja/nej, återkallelse och mobilanpassade Kartinställningar |
| [Agroforestry](https://gislab.se/lab/agroforestry/) | Lokala fastighets-, höjd- och planteringsdata; OpenStreetMap Foundation samt Esri (`server.arcgisonline.com`, `clarity.maptiles.arcgis.com`) | Ny dialog med leverantörsinformation för vald bakgrund; separat godkännande vid leverantörsbyte; sparat ja/nej |
| [Klimatverkstad](https://gislab.se/klimatverkstad/#mat) | Lokala analyslager; valbar OpenStreetMap-bakgrund | Befintlig referensimplementation bevarad |
| [Havsnivå och klimatanpassning](https://gislab.se/lab/havsniva-klimatanpassning/) | Egna terräng- och kartresurser | Ingen extern kartleverantör kontaktas, ingen dialog behövs |
| [Sälenfjällen i 3D](https://gislab.se/lab/salenfjallen-3d/) | Egna terräng- och kartresurser | Ingen extern kartleverantör kontaktas, ingen dialog behövs |
| [Vattenförbrukning i Vättern](https://gislab.se/lab/vattenforbrukning/) | Egen 3D-modell och lokala resurser | Ingen extern kartleverantör kontaktas, ingen dialog behövs |

Agroforestrys sex alternativ är Esri World Imagery, Esri Clarity, Esri World Topo Map, Esri World Street Map, Esri World Light Gray Base och OpenStreetMap. Källhänvisningarna i respektive rasterlager har bevarats. Att dataset har en extern ursprungskälla innebär inte i sig att besökarens webbläsare kontaktar den källan.

Regionkartans sida på gislab.se är en presentation med en länk till en separat prototyp på `chatgpt.site`, inte en inbäddad karta. Kollektivtrafik i Dalarna och Omvända skiftet länkar till separata Streamlit-webbplatser. Dessa tjänster, liksom den separata kollegieportalen, ingår inte i ändringen av kartverktygen på gislab.se. `/klimatinitiativet/` omdirigerar till Klimatverkstad.

## Beteende och lagring

Gemensam kod: `scripts/map-consent.js` och `assets/map-consent.css`. Kartorna börjar utan rasterkälla/lager. Bara ett uttryckligt ja eller ett giltigt tidigare ja aktiverar kartbilder. Ett alternativ i Agroforestrys bakgrundslista öppnar dialogen; det hämtar inga bilder från den nya leverantören. Dialogens kryss och Escape lämnar det tidigare valet och bakgrunden orörda. ”Fortsätt utan” återkallar och sparar nej. ”Utan bakgrund” i Agroforestry gör samma sak.

Lagringsnycklar: `gislab:stockholm-torsboda:map-background` och `gislab:agroforestry:map-background`. Varje post innehåller informationsversion, verktyg, en uttrycklig leverantör, bakgrundsalternativ, booleskt val, valtid och utgångstid. Ingen besökaridentitet lagras. Både ja och nej gäller exakt 180 dagar från valet. Läsning vid återbesök förlänger inte tiden. Ett nytt val ersätter det gamla; inga tidigare ja för andra leverantörer återanvänds.

Utgångna poster, ogiltig JSON, fel datatyper, fel verktyg eller leverantör, extra leverantörer, framtida valtid, fel varaktighet, okänd bakgrund och äldre informationsversioner aktiverar aldrig bakgrunden. De tas bort om lagringen tillåter det och en ny fråga visas. Om lagring är blockerad fungerar valet i sidans minne och användaren får besked. Om lagring av återkallelse misslyckas försöker koden även ta bort ett äldre ja.

Dialogen har lika utformade knappar, namn och beskrivning för hjälpmedel, initialt fokus på rubriken, Tab/Shift+Tab inom dialogen och återfört fokus till Kartinställningar. Kartans egna kortkommandon körs inte inne i dialogen. Båda valknapparna är synliga även på smala skärmar; informationen kan rullas. Agroforestrys knapp ligger i en rad ovanför kartan. Stockholms knapp ligger i en nederkant med plats reserverad för navigationsknappar, panel och attribution.

## Källprojekt och framtida byggen

`scripts/sync-map-consent.cjs` uppdaterar de befintliga källprojekten utan att committa eller publicera deras andra ändringar:

- `C:/gislab/projekt/datacenter/stockholm-3d`: båda kartskripten i `dist`, HTML, lokal kopia av gemensam JS/CSS samt README.
- `C:/gislab/projekt/experimentella_geografier/Anderslov`: kartkod, mall, planteringskod, genererad planteringskarta, lokal JS/CSS, publiceringsskript och README. Publiceringsskriptet kopierar samtyckesfilerna och dess tidigare automatiska aktivering av Esri är borttagen. Det redan publicerade uttryckliga sparandet av planteringsplaner har även förts tillbaka till källan så att ett bygge inte återinför automatisk lagring.

Bakgrundsleverantörer har en explicit tillåtelselista. Lägg till en ny leverantör med korrekt information och höj informationsversionen när informationens omfattning ändras. Klimatverkstads befintliga källkod och lagringsnyckel har inte bytts ut.

## Tester före publicering

- `node --test tests/privacy.test.cjs`: 5 godkända tester, inklusive kontroll av externa resursreferenser.
- `tests/map-consent.browser.cjs`: 38 godkända kontroller i installerad Chrome med nya webbläsarkontexter. Testet använder ersatta kartbilder lokalt; det registrerar fortfarande de verkliga begärda adresserna. Ingen övrig extern trafik tillåts före val.
- För båda uppdaterade kartorna: första besök, sparat nej, sparat ja, omladdning, återkallelse, panorering/zoom utan nya kartanrop, kryss/Escape utan ändring, tangentbordsfokus, felaktiga/utgångna/versionerade poster, blockerad lagring samt misslyckad lagring av återkallelse.
- Agroforestry: alla sex bakgrunder; OSM-godkännande aktiverar inte Esri; avbrutet leverantörsbyte behåller tidigare val; direkt ”Utan bakgrund” återkallar.
- 320 × 700, 390 × 844 och 1440 × 1000: lika stora valknappar, båda synliga före rullning, fungerande tangentbord och Kartinställningar utan överlapp med kartans navigationsknappar. Skärmbilder granskade.
- De tre kartorna med egna resurser: inga externa anrop, inga JavaScript-fel och ingen samtyckesdialog.
- Syntaxkontroller av delad kod, synkronisering och ändrade källskript.
- Agroforestrys HTML byggdes om från källmallen och befintlig kartdata i en separat testkopia. Publiceringsskriptet kördes där. Samtyckesresurser, explicit plansparande och borttagna fastighetsidentifierare verifierades.
- Båda uppdaterade källdistributionerna kördes i Chrome: första besök, sparat val, ja/nej, inga skriptfel. Agroforestrys spara/radera-funktion provades också.

## Produktionskontroll

Publicering sker via webbplatsens befintliga `main` och GitHub Pages. Resultatet av kontrollen på de riktiga adresserna redovisas efter genomförd publicering.

De svenska och engelska integritetssidorna beskriver nu alla tre verktygens sparade kartval. Deras befintliga utkastmarkering för kvarstående verksamhets- och leverantörsfrågor bevaras. Nätverkstester verifierar klientens beteende, inte leverantörernas interna loggning eller avtal.
