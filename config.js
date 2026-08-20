window.FREEZER_APP_CONFIG = {
  appTitle: "Lab Freezer Scanner",
  portalUrl: "https://www.arcgis.com",
  oauthAppId: "KjDgfnd8tToLcsTA",
  layerUrl: "https://services8.arcgis.com/V78yHC8goSD1vt01/arcgis/rest/services/FieldSeekerBarcodePrototype_View/FeatureServer/1",
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
  // Used only for demo/sample records. Live check-in validates Barcode only.
  retrievedValue: "R",
  recentLimit: 500,
  demoWhenUnconfigured: true
};
