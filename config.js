window.FREEZER_APP_CONFIG = {
  appTitle: "Lab Freezer Scanner",
  portalUrl: "https://www.arcgis.com",
  oauthAppId: "PASTE_ARCGIS_OAUTH_CLIENT_ID_HERE",
  layerUrl: "PASTE_TRAPDATA_FREEZER_VIEW_LAYER_URL_HERE",
  fields: {
    barcode: "Barcode",
    activity: "TRAPACTIVITYTYPE",
    retrieved: "ENDDATETIME",
    location: "LOCATIONNAME",
    zone: "ZONE",
    fieldTech: "FIELDTECH",
    reviewedBy: "REVIEWEDBY",
    freezerTime: "REVIEWEDDATE"
  },
  retrievedValue: "R",
  recentLimit: 500,
  demoWhenUnconfigured: true
};
