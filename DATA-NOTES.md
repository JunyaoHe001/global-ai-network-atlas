# Data notes

## Network semantics

For each year from 2016 to 2025, the public atlas uses the processed ADM1 network tables. Two ADM1 regions are connected when both occur in the same filtered AI-related news document. The edge weight is the number of unique documents in which the pair is co-mentioned. The network is therefore **undirected**.

The original node-table field `n_docs` was not used in the public atlas because its values correspond to processing-part presence rather than the actual number of unique documents. For the visualisation, unique document counts were recomputed from the private document–ADM1 intermediate tables and only the resulting aggregate counts were exported.

## Geography

The supplied `geoBoundariesCGAZ_ADM1.geojson` was used to match every network region. All 1,457 regions appearing in at least one annual network matched the supplied ADM1 geometry. Geometry was simplified and converted to compact SVG-display paths; original shape IDs are not published.

## Coverage

The atlas uses annual processed networks for 2016–2025. It does not publish raw article-level or source-level records.


## Zero-value ADM1 coverage

The map does not drop ADM1 units when their activity is zero. The supplied boundary file contains 3,224 polygon features and 3,223 unique country–ADM1 name pairs. All geometry is retained in the public map; the duplicate Mazandaran features are combined into one public ADM1 unit. Only 1,457 ADM1 units appear in at least one 2016–2025 network, while all remaining units are kept as explicit zero-value geography. Very small polygons below the integer projection resolution receive a minimum visible footprint in the web map so that they remain selectable.
