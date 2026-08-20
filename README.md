# FieldSeeker Freezer Scanner v1.17

## What v1 does
- Scan/enter Trap Barcode
- Look up TrapData using **Barcode only**
- If no record exists: show **Barcode not found**
- If more than one record has the barcode: stop with a duplicate-barcode error
- If the record already has REVIEWEDDATE: open/show the trap and say **Already in freezer**; do not change or add anything
- If REVIEWEDDATE is null: automatically set REVIEWEDDATE to the current time
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

## Important — v1.2 barcode rule

The live lookup is now intentionally only:

```sql
Barcode = '<scan>'
```

Then the app decides:

```text
0 matches
→ BARCODE NOT FOUND
→ no edit

1 match + REVIEWEDDATE has a value
→ ALREADY IN FREEZER
→ show existing trap / Freezer Time / Reviewed By
→ no edit
→ do not add to the session counter or right-panel list

1 match + REVIEWEDDATE is null
→ set REVIEWEDDATE = current time
→ set REVIEWEDBY = signed-in ArcGIS username
→ save immediately

more than 1 match
→ DUPLICATE BARCODE
→ no edit
```

`TRAPACTIVITYTYPE` is no longer required for freezer check-in validation.

A successful new scan immediately writes `REVIEWEDDATE`; there is no Submit button.


## Freezer operator audit

On each successful check-in, v1.1 writes both fields in the same update:

```text
REVIEWEDDATE = current timestamp
REVIEWEDBY   = signed-in ArcGIS username
```

The username is stored as the permanent freezer operator identity. The app may display the user's full name for readability, but REVIEWEDBY stores the ArcGIS username.


## v1.3 camera behavior

After the camera recognizes any barcode, it immediately closes the camera preview and shows the validation result.

This applies to:
- a new valid freezer check-in,
- an already-in-freezer barcode,
- a barcode not found in TrapData,
- and a duplicate barcode.

Tap **Open Camera Scanner** again for the next trap.


## v1.4 freezer eligibility

A barcode must exist in TrapData, and a new freezer check-in is accepted only when the record is already **Retrieved**.

The app requires both:

```text
TRAPACTIVITYTYPE = R
ENDDATETIME is not null
```

Decision order:

```text
barcode not found
→ BARCODE NOT FOUND
→ no edit

barcode found + REVIEWEDDATE already set
→ ALREADY IN FREEZER
→ no edit

barcode found + not Retrieved
→ NOT RETRIEVED
→ no edit

barcode found + Retrieved + REVIEWEDDATE null
→ REVIEWEDDATE = current time
→ REVIEWEDBY = signed-in ArcGIS username
→ save
```

This keeps barcode lookup simple while preventing a trap from being freezer-checked before the field Retrieve step is complete.


## v1.5 changes
- Right-hand freezer list queries the current calendar week only (Monday start by default).
- Exact barcode lookup is not week-limited, so a trap crossing a week boundary can still be found.
- Check In button and Enter key perform the same action.
- Front/Back camera selector added; Front is the default for a wall-mounted iPad.


## v1.6 UI changes

### Camera control
The large **Open Camera Scanner** text button and Front/Back dropdown are removed.

There is now one round camera control:

- **📷** when the camera is closed: opens the remembered/default camera.
- **🔄** while the camera is open: switches Front ↔ Back immediately.
- **✕** closes the camera manually.
- After any barcode is decoded, the camera still closes automatically so the result is visible.
- The last selected camera is remembered on that browser/iPad.

### Freezer-list period filter
The panel is now titled **Traps Added** and has a **Period** filter:

- Today
- **This Week** (default)
- Last 7 Days
- Last 30 Days
- All

Changing the period triggers a new ArcGIS query; the app does not have to load all historical TrapData each time. Barcode scan lookup itself remains unrestricted by period.


## v1.7 compact camera/status row

The camera control and scan status are now on the same horizontal row:

```text
[ 📷 ]   ●  Ready
         Scan the first trap.
```

When the camera is open, the same camera button becomes the switch-camera button:

```text
[ 🔄 ] [ ✕ ]   ●  Front camera ready
               Scan a trap barcode.
```

After any barcode is decoded, the camera closes and the result remains visible in that same row.


## v1.8 camera beside barcode

The separate **Check In** button has been removed.

```text
[ Scan or type barcode                         ] [ 📷 ]
```

- Manual entry: press **Enter**.
- Bluetooth/USB barcode scanner: scan + Enter submits automatically.
- Camera: tap **📷**. While open, the same button becomes **🔄** to switch cameras and **✕** closes it manually.
- After any barcode is decoded, the camera closes and the result is shown.


## v1.9 simplified scanner panel

- Removed the **Session** counter. It only counted successful new freezer check-ins since the current page/app session started, so it was redundant with the filtered trap list.
- Combined status, rules, and trap information into one expandable **Scan Status** group.
- The group is compact while idle.
- It automatically expands after a barcode result so the operator can see trap details.
- The operator can collapse it again by tapping the status row.


## v1.10 instruction cleanup

The always-visible operating instructions were removed from the scanner panel.

The title now shows a circular info control:

```text
Freezer Check-In  (i)
```

Tap **i** to show the instructions; tap it again to close them. The normal scanner interface stays compact.


## v1.11 instruction popover fix

Fixed the info popover text wrapping. Inline emphasis such as **Enter** and **Retrieved** now stays on the same sentence line instead of forcing line breaks.


## v1.12 sortable table headers

The separate **Sort** dropdown was removed.

Click a table header to sort by that field. Click the same header again to reverse the direction.

The default is:

```text
Time in Freezer ▼
```

which means **longest time in freezer first**.

Sortable columns:
- Barcode
- Location
- Retrieved
- Freezer Time
- Time in Freezer
- Freezer By


## v1.13 Traps Added query limit

The **Traps Added** list now only queries records that already have a Freezer Time:

```sql
REVIEWEDDATE IS NOT NULL
```

The period filter is limited to:

- Today
- This Week (default)
- Last 7 Days
- Last 30 Days

The **All** option was removed.

Even if the UI or config passes an unexpected period value, the app falls back to a hard **30-day maximum**, so the freezer list never queries the full TrapData history.

The barcode scan lookup is unchanged and still searches the full TrapData layer by exact barcode so an older valid trap can still be found.


## v1.14 query loading feedback

The **Traps Added** panel now has a visual busy state for ArcGIS queries.

While Refresh or Period filtering is running:

- a spinner overlays the table,
- the message says **Loading freezer records…** or **Updating freezer list…**,
- the Refresh button changes to **Loading…**,
- Refresh and Period controls are temporarily disabled.

This is an indeterminate spinner rather than a percentage bar because ArcGIS `queryFeatures()` does not provide query progress percentages.


## v1.15 shared lab login + Creator-based Freezer By

`REVIEWEDBY` is no longer populated from the ArcGIS account currently signed into the Freezer Scanner.

The app now automatically detects the TrapData editor-tracking Creator field:

1. `created_user` — preferred for production TrapData
2. `Creator` — fallback for the prototype TrapData

On a successful freezer check-in:

```text
REVIEWEDDATE = current check-in time
REVIEWEDBY   = TrapData Creator
```

This allows a shared/dedicated lab ArcGIS account to remain signed into the freezer iPad without requiring each user to switch ArcGIS accounts before scanning.

The signed-in ArcGIS account is still required for permission to query and update the feature layer, but it is no longer used as the value written into `REVIEWEDBY`.

If neither `created_user` nor `Creator` exists, or if the detected Creator value is blank, the app refuses the freezer update and shows an error rather than writing the shared lab username.


## v1.16 explicit Creator field + scan cleanup

The app no longer auto-detects `Creator` versus `created_user`.

The source field for **Freezer By** is defined explicitly in `config.js`:

```javascript
fields: {
  ...
  creator: "Creator",
  reviewedBy: "REVIEWEDBY",
  freezerTime: "REVIEWEDDATE"
}
```

For the production TrapData layer, change only:

```javascript
creator: "created_user"
```

### Failed scan behavior

At the start of every new scan, the previous **Trap Information** is cleared.

If the new barcode is not found, the previous trap no longer remains visible.

The error message also includes the scanned barcode, for example:

```text
NOT CHECKED IN
T260000001: Barcode was not found in TrapData.
```

If the barcode exists, the current matching Trap Information is shown for:
- successful freezer check-in,
- already in freezer,
- not retrieved.


## v1.17 clickable error X

When the scanner shows an error such as **NOT CHECKED IN** or **NOT RETRIEVED**, the red `✕` icon is now clickable.

Clicking/tapping the `✕`:

- clears the barcode text box,
- clears any displayed Trap Information,
- returns the status to **Ready — Scan the next trap**,
- collapses the status details,
- puts focus back in the barcode box.

The `✕` is only interactive while the status is an error.
