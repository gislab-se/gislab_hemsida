# Integritetsgranskning av GISLab

Datum: 2026-10-28. Avser den lokala publika webbplatsen i detta repo, inklusive kartverktygen på samma domän. Ändringarna är inte publicerade. Användaren har bekräftat Tåghusa 1:38 AB som ansvarigt bolag och one.com som e-postleverantör. Gallringsrutiner, närmare e-posthantering och leverantörsbedömningar återstår; integritetssidorna är därför tydligt märkta utkast med `noindex`.

## Bedömning och regler

Den granskade publika koden innehåller ingen analys- eller annonsspårning och inga egna cookies. Därför finns inget identifierat behov av en generell samtyckesbanner för statistik eller marknadsföring i den nuvarande versionen. Det är en bedömning av den granskade implementationen, inte en garanti om produktionsmiljön eller framtida externa tjänster.

| Område | Vad som krävs | Tillämpning på GISLab |
| --- | --- | --- |
| Åtkomst till besökarens enhet | LEK 9 kap. 28 § omfattar lagring och hämtning, inte bara cookies. Information och samtycke krävs som huvudregel. Undantag finns för överföring av meddelanden och vad som är nödvändigt för en uttryckligen begärd tjänst. | Planen i Agroforestry läses, sparas och raderas endast genom respektive uttryckliga knapptryck. Bedömningen är att just lagringen är nödvändig för den begärda sparfunktionen. |
| Icke nödvändiga cookies | Föregående aktivt och ändamålsspecifikt samtycke, lika enkelt ja och nej i samma vy, inga förkryssade val, enkel återkallelse och information om innehåll, syfte, mottagare och varaktighet. | Ingen sådan spårning är identifierad. Om den införs måste den blockeras före val och hanteras med riktiga samtyckesinställningar. En informationsbanner ensam räcker inte. |
| Personuppgifter | Information om ansvarig, ändamål, rättslig grund, mottagare, lagring och rättigheter behöver stämma med den faktiska hanteringen. | Integritetssidor på svenska och engelska är förberedda. Verksamhetsuppgifter får inte fyllas i genom antaganden. |
| Leverantörer | Utred personuppgiftsansvarig respektive biträde. PUB-avtal behövs när en leverantör behandlar personuppgifter för verksamhetens räkning. | Hosting, e-post och karttjänster behöver bedömas var för sig. En policy på leverantörens webbplats ersätter inte nödvändiga avtal. |
| Länder utanför EU/EES | Bedöm tillämpligt överföringsstöd och information om detta. Ett vanligt kartval ersätter inte kraven för tredjelandsöverföringar. | GitHub, one.com och kartleverantörernas underleverantörer behöver granskas. |

Reglerna ovan stöds av [LEK 9 kap. 28 §](https://data.riksdagen.se/dokument/sfs-2022-482.html), [PTS vägledning om cookies](https://www.pts.se/internet-och-telefoni/kakor-cookies/), [IMY om integritetspolicy](https://www.imy.se/vanliga-fragor-och-svar/vad-ska-en-integritetspolicy-innehalla/), [IMY om PUB-avtal](https://www.imy.se/vanliga-fragor-och-svar/behover-vi-ett-personuppgiftsbitradesavtal/) och [IMY om de begränsade undantagen för tredjelandsöverföringar](https://www.imy.se/verksamhet/dataskydd/det-har-galler-enligt-gdpr/overforing-till-tredje-land/sarskilda-situationer-och-enstaka-overforingar/).

## Inventering och genomförda ändringar

| Del | Före | Efter |
| --- | --- | --- |
| Startsida, engelska sidan, Labbet och Regionkartans presentation | Google Fonts och anslutningsförberedelser till Google | Systemtypsnitt; inga automatiska typsnittsanrop till Google. Integritetslänkar även på sidor som saknade sidfot. |
| Klimatverkstad | Google Fonts och automatisk OpenStreetMap-bakgrund | Systemtypsnitt och lokal kartdata. OpenStreetMap aktiveras och stängs av i samma panel efter information om överförda uppgifter. |
| Stockholm × Torsboda | Automatisk OpenStreetMap-bakgrund | Befolkningsdata och verktyg fungerar lokalt. Rasterkälla och lager skapas först efter användarens val och tas bort när bakgrunden stängs av. |
| Agroforestry, kartbakgrund | Inline-kod valde automatiskt Esris satellitbilder | Automatiken borttagen. ”Utan bakgrund” är standard; information finns intill leverantörsvalet. |
| Agroforestry, planteringsutkast | Läste localStorage vid start och sparade ändringar automatiskt utan tidsgräns | Sparar, läser och raderar endast på användarens uttryckliga begäran. Ingen automatisk åtkomst vid sidladdning eller redigering. Befintliga sparade planer kan läsas med knappen. |
| Havsnivå, Sälenfjällen och Vattenförbrukning | Externa Google Fonts-importer i byggd CSS | Systemtypsnitt, samt befintlig lokalt lagrad Fraunces i Vattenförbrukning. Integritetslänk i varje verktyg. |
| E-post | Lokal mailto-länk | Oförändrat flöde. Information förklarar att webbplatsen öppnar användarens e-postprogram. Användaren har bekräftat one.com som e-postleverantör; detta anges i båda integritetsutkasten. |
| Referrer | Webbläsarens standardbeteende | Explicit `strict-origin-when-cross-origin` på de granskade sidorna. Externa resurser får webbplatsens ursprung, inte hela sidans sökväg eller frågesträng. |

Extern kartbakgrund är ett frivilligt funktionsval, inte en generell cookiehanterare. Valet lagras enbart i sidans minne och återställs vid omladdning. Om en leverantör i den verkliga miljön sätter andra än nödvändiga cookies måste dessa separat bedömas och vid behov blockeras. Att stoppa nya anrop kan inte återta redan överförda uppgifter.

Den enda egna beständiga webbläsarlagring som identifierats är `localStorage["sorby-planting-draft-v1"]`: åkergräns och planteringsavstånd. Uppgifterna lämnar inte enheten genom sparfunktionen. De har ingen automatisk utgångstid och raderas med ”Radera sparad plan” eller rensning av webbplatsdata. Detta framgår vid kontrollerna och i integritetstexten. En exporterad GeoJSON-fil påverkas inte av radering i webbläsaren.

GitHub Pages loggar IP-adresser för säkerhetsändamål, även för utloggade besökare, enligt [GitHubs Pages-dokumentation](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages#data-collection). Därför betyder frånvaro av egna cookies inte frånvaro av personuppgiftsbehandling. Läs även [GitHubs integritetspolicy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement), [OpenStreetMap Foundations policy](https://osmfoundation.org/wiki/Privacy_Policy) och [Esris information](https://www.esri.com/en-us/privacy/privacy-statements/privacy-statement). Leverantörernas exakta roller, tillämpliga villkor, lagring och överföringsstöd är inte fastställda i denna kodgranskning.

## Prioriterat före publicering

1. **Färdigställ verksamhetsuppgifter:** Tåghusa 1:38 AB och one.com är bekräftade. Klargör nu behandlingsländer och verklig lagring/gallring av förfrågningar. Fastställ rättslig grund och dokumentera eventuell intresseavvägning. Färdigställ båda språkversionerna av integritetssidan, ta bort utkastmarkering och `noindex` och lägg då till sidorna i sidkartan.
2. **Bedöm leverantörer:** verifiera faktisk GitHub Pages-konfiguration och tillämpliga villkor; kartlägg e-post och valda karttjänster. Dokumentera roller, PUB-avtal där det behövs och stöd för eventuella tredjelandsöverföringar. Juridisk hjälp är lämplig om rollerna eller överföringsstödet är oklara. Ett klick på ”Visa extern bakgrund” ska inte användas som allmänt undantag för internationella överföringar.
3. **Verifiera skarp drift:** testa den publicerade domänen i ren webbläsarprofil, utan och med externa bakgrunder. Kontrollera faktiska svarshuvuden, HTTPS, cookies, lagring och återkallelse. Bekräfta att ingen CDN, proxy eller tillagd driftintegration inför ytterligare behandling. Sätt vid behov kompletterande samtyckeshantering utifrån vad verkliga leverantörssvar visar.
4. **Inför verksamhetsrutiner:** bestäm vem som hanterar rättighetsbegäranden, hur uppgifter söks fram och gallras, hur konton skyddas och hur incidenter hanteras. Policyn behöver motsvara praktiken. Detta är organisatoriskt arbete som inte blir färdigt genom frontend-kod.

För one.com anger [leverantörens GDPR-information](https://help.one.com/hc/sv/articles/360000253649-Hur-f%C3%B6ljer-one-com-GDPR) att tjänsten normalt agerar biträde för kunders e-post och att ett biträdesavtal ingår i abonnemangsavtalet. Att just bolagets abonnemang omfattas, vilka underleverantörer som används och vilka länder som berörs är ännu inte verifierat. Någon fast gallringstid har inte beslutats: enligt [IMY:s information om lagringstid](https://www.imy.se/vanliga-fragor-och-svar/hur-lange-far-vi-spara-uppgifter/) får personuppgifter inte behållas längre än ändamålet kräver. Vanliga avslutade förfrågningar måste därför skiljas från underlag som behövs för exempelvis avtal eller bokföring.

Att välja bort automatiska externa typsnitt och kartbakgrunder är en rekommenderad metod för dataminimering, inte ett generellt lagkrav att använda just denna teknik. Någon garanti om full GDPR-efterlevnad lämnas inte genom kodändringarna.

## Verifiering

- `node --test tests/privacy.test.cjs`: fem tester av förhandsblockering, aktivering, återkallelse, uteblivna kontroller och publika resursreferenser.
- Syntaxkontroll av den gemensamma kartvalskoden, båda Stockholm-skripten och Klimatverkstads ändrade bundle.
- Lokal webbläsargranskning i installerad Chrome/Playwright av 13 adresser: svenska och engelska startsidor, Labbet, projektsida, Regionkartans presentation, båda integritetsutkasten och samtliga sex kartverktyg.
- I ren profil: inga automatiska externa anrop, cookies eller anrop till webbläsarens lagrings-API registrerades. Inga JavaScript-fel eller saknade lokala resurser registrerades.
- Aktivt kartval kontrollerat i Klimatverkstad, Stockholm × Torsboda och Agroforestry. Kartbilder begärdes först efter val; nya kartanrop upphörde efter avstängning även vid zoomning. Valet återställdes vid omladdning.
- Agroforestry: spara/läs/radera, redigering utan automatisk lagring, omladdning utan automatisk läsning och felaktigt sparad plan kontrollerade.
- Externa kartbildssvar ersattes med testbilder i webbläsartesterna. Testerna verifierar anropens tidpunkt och avstängning, inte verkliga leverantörers cookies eller logghantering. Produktionsdomänen kunde inte hämtas med webbläsningsverktyget. Produktionsgranskningen återstår.
- Svenska startsidan och Stockholm-kartan kontrollerade visuellt; mobilvy användes för kartkontrollerna.

## Underhåll

Flera kartverktyg är incheckade, färdigbyggda appar. Ändringarna i deras HTML, JavaScript och CSS måste bevaras vid framtida kopiering från ursprungsprojekten. Återinför inte Google Fonts-importer, automatisk extern kartbakgrund eller automatisk läsning/sparning av planteringsplaner. Kör integritetstesterna när nya appar eller tjänster läggs till. Kollegieportalen, externa Streamlit-appar och den länkade Regionkarteprototypen omfattas inte av denna granskning.
