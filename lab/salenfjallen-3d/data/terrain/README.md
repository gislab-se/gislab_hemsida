# Terrängdata

`build_terrain.py` skriver två publicerbara filer här:

- `salen-pilot.json` – metadata för gridet
- `salen-pilot.bin` – höjder som 32-bitars flyttal, rad för rad

De är avsedda att genereras lokalt från Lantmäteriets COG-filer och ska inte
versionshanteras. När filerna saknas använder webbplatsen en tydligt märkt
illustrativ reservterräng, så att gränssnittet kan byggas och testas utan data.
