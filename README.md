# Hubble-diagram

Interactive Hubble diagram for students aged 14–18.

Click galaxies on a sky map. For each one, see the curated distance and
recession velocity, or — where the data is available — work out distance
yourself from a Cepheid star and redshift yourself from a real spectrum.
Build up a Hubble diagram point by point and see Hubble's constant emerge
from the slope of the line.

## Running locally

```bash
npm install
npm run build:data    # one-shot: pre-fetches Cepheid catalogs, OGLE light
                      # curves and SDSS spectra into public/data/
npm run dev           # http://localhost:5173
```

## Build

```bash
npm run build         # multi-file Firebase Hosting build → dist/
npm run build:embed   # single-file build for Google Sites etc → dist-embed/
npm run deploy        # firebase deploy --only hosting
```

## Layout

- `src/data/` — galaxy seed list, VizieR/SDSS/OGLE loaders, physics helpers
- `src/ui/` — Aladin sky viewer, D3 Hubble chart, Cepheid/light-curve/spectrum modals
- `public/data/` — pre-fetched dataset bundle (built by `scripts/build-data.ts`)
- `scripts/build-data.ts` — one-shot pre-fetcher

## Credits

Built on h-r-diagram (sibling project). Data from VizieR/CDS, SDSS DR17,
OGLE-IV, and SIMBAD.
