# Kontroll av publicerad webbplats

Datum: 2026-10-28. Webbplats: [gislab.se](https://gislab.se/).

Integritetsändringarna publicerades i commit [`923ad5f`](https://github.com/gislab-se/gislab_hemsida/commit/923ad5fe28ee4b6f4de98ffb35c1a759f15b0e52). [GitHub Pages-publiceringen](https://github.com/gislab-se/gislab_hemsida/actions/runs/40696098386) slutfördes utan fel. Den tidigare publicerade Köpenhamnsbilden bevarades.

## Metod

Den riktiga HTTPS-webbplatsen öppnades i installerad Chrome med en ny, ren webbläsarkontext för varje adress. Inga nätverksanrop avlyssnades för att ersätta eller blockera svar; inga kartbilder simulerades. Svar från OpenStreetMap och Esri kom från de verkliga tjänsterna. Service workers var blockerade i testprofilen. Testet omfattar webbplatsens trafik, inte webbläsarens egen bakgrundstrafik eller leverantörernas interna serverloggar.

Vi registrerade nätverksanrop, HTTP-status, namn i eventuella Set-Cookie-svarshuvuden, lagrade cookies och åtkomst till localStorage/sessionStorage. Rapporten sparar inte cookieinnehåll, mejl eller personliga inloggningsuppgifter.

## Resultat före användarens val

| Adress | HTTP-status | Cookies | Externa nätverksanrop | localStorage/sessionStorage |
| --- | --- | --- | --- | --- |
| `/` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |
| `/en/` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |
| `/lab/` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |
| `/lab/project.html?id=regionkarta` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |
| `/lab/regionkarta/` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |
| `/integritet/` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |
| `/en/privacy/` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |
| `/lab/havsniva-klimatanpassning/` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |
| `/lab/salenfjallen-3d/` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |
| `/lab/vattenforbrukning/` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |
| `/klimatverkstad/` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |
| `/lab/stockholm-torsboda/` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |
| `/lab/agroforestry/` | 200 | 0 | 0 | Tomma, ingen registrerad API-åtkomst |

Totalt registrerades 442 nätverkssvar under hela testet, inklusive aktivering av externa kartor och omladdningar. Inga Set-Cookie-svarshuvuden eller lagrade cookies registrerades, inte heller efter aktivering av de testade kartbakgrunderna. Inga misslyckade nätverksanrop, HTTP-fel eller JavaScript-fel registrerades i körningen. HTTPS-sidorna använde giltiga certifikat och TLS 1.3.

## Externa kartor och sparande

- **Klimatverkstad och Stockholm × Torsboda:** OpenStreetMap-bilder hämtades först efter ”Visa extern bakgrund” och svarade med HTTP 200. Efter ”Dölj extern bakgrund” skickades inga nya externa anrop, även vid zoomning. En omladdning återställde valet till av.
- **Agroforestry:** OpenStreetMap samt Esris satellitbild, Clarity, topografiska karta, gatukarta och ljusgrå karta testades. Alla gav riktiga kartbildssvar med HTTP 200 först efter aktivt val. ”Utan bakgrund” stoppade nya externa anrop, även vid zoomning.
- De enda externa värdar som kontaktades efter aktivering var `tile.openstreetmap.org`, `server.arcgisonline.com` och `clarity.maptiles.arcgis.com`.
- Agroforestrys sparknapp skapade endast nyckeln `sorby-planting-draft-v1` i localStorage. Läsning och radering fungerade. Efter radering var lagringen tom igen. Planen sparades i testprofilen på besökarens enhet, utan ett nytt nätverksanrop för sparandet.

## Upptäckt och rättat: HTTP utan omdirigering

Första kontrollen visade att `http://gislab.se/` gav HTTP 200 utan omdirigering. GitHub Pages hade `https_enforced: false`, trots ett godkänt certifikat för både gislab.se och www.gislab.se.

”Enforce HTTPS” aktiverades. Därefter verifierades följande med riktiga HTTP-anrop:

| Ingång | Resultat |
| --- | --- |
| `http://gislab.se/` | 301 till `https://gislab.se/`, sedan 200 |
| `http://www.gislab.se/` | 301 till `https://gislab.se/`, sedan 200 |
| `https://www.gislab.se/` | 301 till `https://gislab.se/`, sedan 200 |

GitHub Pages bekräftade `https_enforced: true`. Domänen gislab.se och publiceringskällan main, rotkatalogen, bevarades. Inställningen stöds av [GitHubs dokumenterade Pages-API](https://docs.github.com/en/rest/pages/pages#update-information-about-a-github-pages-site).

Åtta centrala publicerade HTML-, JavaScript- och CSS-filer jämfördes med commitens exakta innehåll genom SHA-256. Alla svarade med HTTP 200 och matchade: svenska och engelska startsidan, kartvalskoden, dess CSS, Klimatverkstads JavaScript, Agroforestrys HTML, Stockholm-kartans JavaScript och Vattenförbruknings CSS.

## Vad kontrollen inte avgör

Detta verifierar den tekniska versionen i den testade webbläsaren och vid testtillfället. Det avgör inte leverantörernas interna loggning, avtal, behandlingsländer eller rättsliga grunder. Den separata portalen och länkade externa appar omfattades inte.

Integritetssidorna är fortfarande tydligt märkta som utkast och har `noindex`. Tåghusa 1:38 AB är angivet som personuppgiftsansvarig och one.com som e-postleverantör. Verksamheten har bekräftat att det är få förfrågningar och att gallringsrutin saknas. Ingen gallringstid har därför skrivits in som ett redan fattat beslut, och ingen automatisk mejlradering har införts. Leverantörsbedömningarna och den rutinen återstår enligt [integritetsgranskningen](PRIVACY_REVIEW.md).
