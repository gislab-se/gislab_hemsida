# Terrängdata

Lägg den publicerbara terrängen här som `<namn>.json` och `<namn>.bin`.
`skane-overview.json` är standardfilen som laddas av webbplatsen. Bygg den med
`scripts/build_terrain.py` från Lantmäteriets lokalt hämtade GeoTIFF/COG-filer.

Råa GeoTIFF-filer finns aldrig i Git. Den publicerade översikten har en separat
giltighetsmask, så NoData aldrig tolkas som markhöjd eller havsbotten.
