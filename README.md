# Global AI Regional Network Atlas

Interactive ADM1-level atlas for the working paper *Measuring Global AI Cooperation, Competition and Innovation through News Text: A Graph-based Approach*.

The public website uses only visualisation-ready aggregate network data and simplified ADM1 geometry. It excludes news text, headlines, document URLs, source-site names, document identifiers, raw location strings, local paths, original geometry identifiers and document-level records.

## Public structure

- `index.html`: website entry point
- `assets/`: JavaScript and CSS
- `data/map.json`: 3,223 public ADM1 display units, including zero-value units
- `data/years/2016.json` … `2025.json`: annual aggregated nodes and co-occurrence edges
- `docs/`: data, privacy and validation notes

The application intentionally loads ordinary JSON files rather than a multi-part deployment archive. This makes manual GitHub Pages deployment transparent and reduces the risk of missing-data-part errors.
