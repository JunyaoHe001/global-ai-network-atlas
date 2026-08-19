# Public visualisation sanitisation

The source package contained research-processing and audit outputs beyond what is necessary for the public atlas. The review build deliberately excludes them.

## Removed entirely

- document-level and ADM1-document intermediate tables;
- document URLs;
- article/news text and raw location strings;
- individual news-source names and source-count tables;
- AI term count/audit tables;
- country/source audit tables;
- local Windows paths, database file paths, run directories, and database indexes;
- original PNG outputs;
- raw 344 MB ADM1 GeoJSON;
- original `shapeID` values.

## Retained or derived for the map

- ADM1 region name;
- ISO3 country code;
- simplified display geometry;
- a compact public integer region index;
- unique document count per region/year, recomputed privately and exported only as an aggregate;
- location mention count;
- weighted co-occurrence degree;
- number of regional partners;
- cross-country share of weighted co-occurrence;
- undirected regional co-occurrence edges with annual weights.

No document-level identifier or original shape identifier is present in the public website data.


## Geographic coverage

All supplied ADM1 geometries are retained for map context, including units with zero activity. Public geography contains only ADM1 display name, country code, simplified geometry, and map coordinates; original `shapeID` values remain excluded.
