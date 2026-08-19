# FieldSeeker Freezer Scanner v1.0

## What v1 does
- Scan/enter Trap Barcode
- Find exactly one existing TrapData record where:
  - Barcode matches
  - TRAPACTIVITYTYPE = R
  - REVIEWEDDATE is null
- Automatically set REVIEWEDDATE to the current time
- Automatically set REVIEWEDBY to the signed-in ArcGIS username
- Save with ArcGIS FeatureLayer.applyEdits()
- Refuse zero-match, duplicate-match, and already-frozen cases
- Show the last successful check-in
- Right panel lists traps freezer-checked today
- Sort by Freezer Time, Time in Freezer, Barcode, or Location
- Search by Barcode or Location
- Time in Freezer is calculated live; no FREEZERHOURS field is stored
- Camera scanner + normal barcode-scanner/keyboard input

## Configure
Edit `config.js` and fill in:

```js
oauthAppId: "YOUR_ARCGIS_OAUTH_CLIENT_ID",
layerUrl: "YOUR_TRAPDATA_FREEZER_VIEW_LAYER_REST_URL",
```

The layer URL should normally end in `/FeatureServer/0` (the number may differ).

Default existing fields:
- Barcode
- TRAPACTIVITYTYPE
- ENDDATETIME
- LOCATIONNAME
- ZONE
- FIELDTECH
- REVIEWEDBY
- REVIEWEDDATE

Retrieve is assumed to be stored as `R`.

## Demo mode
Until both ArcGIS values are filled in, the app opens in Demo Mode so you can test the layout and workflow without changing production data.

## ArcGIS OAuth
Register the web app in ArcGIS Online and add redirect URLs for the places you run it, for example:

```text
http://localhost:5500/
https://YOUR_GITHUB_USERNAME.github.io/FieldSeeker-Freezer-Scanner/
```

Put only the OAuth Client ID in `config.js`. Never put an ArcGIS password or client secret in browser code.

## GitHub Pages
Push the files to a GitHub repository, then:

Settings → Pages → Deploy from a branch → main → /(root)

Use the resulting HTTPS address on the iPad.

## iPad
Open the GitHub Pages URL in Safari, allow Camera, then:
Share → Add to Home Screen.

Landscape is recommended for the left scanner/right freezer-list layout.

## Important
The live ArcGIS validation query is:

```sql
Barcode = '<scan>'
AND TRAPACTIVITYTYPE = 'R'
AND REVIEWEDDATE IS NULL
```

A successful scan immediately writes `REVIEWEDDATE`; there is no Submit button.


## Freezer operator audit

On each successful check-in, v1.1 writes both fields in the same update:

```text
REVIEWEDDATE = current timestamp
REVIEWEDBY   = signed-in ArcGIS username
```

The username is stored as the permanent freezer operator identity. The app may display the user's full name for readability, but REVIEWEDBY stores the ArcGIS username.
