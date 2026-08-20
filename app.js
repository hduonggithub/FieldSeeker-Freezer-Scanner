(() => {
  "use strict";
  const cfg = window.FREEZER_APP_CONFIG || {};
  const f = cfg.fields || {};
  const $ = id => document.getElementById(id);

  const state = {
    demo:false, layer:null, identityManager:null, scanner:null, cameraRunning:false, cameraDecodeLocked:false,
    cameraFacing:"user", cameraSwitching:false,
    processing:false, todayRows:[], lastScannedBarcode:"", lastScanAt:0,
    tableSort:{key:"duration",direction:"desc"},
    currentUsername:"", currentFullName:""
  };

  const demoRows = [
    {[f.barcode]:"T26001241",[f.activity]:"R",[f.retrieved]:new Date(Date.now()-7200000),
     [f.location]:"SITE-023",[f.zone]:"3",[f.fieldTech]:"Demo Tech",[f.reviewedBy]:"demo_user",[f.freezerTime]:new Date(Date.now()-360000)},
    {[f.barcode]:"T26001240",[f.activity]:"R",[f.retrieved]:new Date(Date.now()-10800000),
     [f.location]:"SITE-011",[f.zone]:"1",[f.fieldTech]:"Demo Tech",[f.reviewedBy]:"demo_user",[f.freezerTime]:new Date(Date.now()-2640000)},
    {[f.barcode]:"T26001239",[f.activity]:"R",[f.retrieved]:new Date(Date.now()-15600000),
     [f.location]:"SITE-008",[f.zone]:"2",[f.fieldTech]:"Demo Tech",[f.reviewedBy]:"demo_user",[f.freezerTime]:new Date(Date.now()-5520000)}
  ];

  const configured = () => Boolean(cfg.oauthAppId && cfg.layerUrl &&
    !cfg.oauthAppId.includes("PASTE_") && !cfg.layerUrl.includes("PASTE_"));

  const asDate = v => {
    if (!v) return null;
    if (v instanceof Date) return v;
    if (typeof v === "number") return new Date(v);
    const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d;
  };

  const fmtDateTime = v => {
    const d=asDate(v); if(!d) return "—";
    return new Intl.DateTimeFormat(undefined,{month:"2-digit",day:"2-digit",year:"numeric",hour:"numeric",minute:"2-digit",second:"2-digit"}).format(d);
  };
  const fmtShortTime = v => {
    const d=asDate(v); if(!d) return "—";
    return new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(d);
  };
  const durationText = v => {
    const d=asDate(v); if(!d) return "—";
    let mins=Math.max(0,Math.floor((Date.now()-d.getTime())/60000));
    if(mins<60) return `${mins} min`;
    const hours=Math.floor(mins/60); mins%=60;
    if(hours<24) return `${hours}h ${mins}m`;
    const days=Math.floor(hours/24); return `${days}d ${hours%24}h`;
  };
  const sameLocalDay = (v,ref=new Date()) => {
    const d=asDate(v); return !!d && d.getFullYear()===ref.getFullYear() && d.getMonth()===ref.getMonth() && d.getDate()===ref.getDate();
  };

  function startOfLocalWeek(reference=new Date()){
    const d=new Date(reference);
    d.setHours(0,0,0,0);
    const weekStartsOn=Number.isInteger(cfg.weekStartsOn) ? cfg.weekStartsOn : 1;
    const delta=(d.getDay()-weekStartsOn+7)%7;
    d.setDate(d.getDate()-delta);
    return d;
  }

  function sameLocalWeek(value,reference=new Date()){
    const d=asDate(value);
    if(!d) return false;
    const start=startOfLocalWeek(reference);
    const end=new Date(start);
    end.setDate(end.getDate()+7);
    return d>=start && d<end;
  }

  function formatArcgisUtcTimestamp(date){
    const pad=n=>String(n).padStart(2,"0");
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  }

  function startOfLocalDay(reference=new Date()){
    const d=new Date(reference);
    d.setHours(0,0,0,0);
    return d;
  }

  function periodStart(period){
    const now=new Date();
    if(period==="today") return startOfLocalDay(now);
    if(period==="this-week") return startOfLocalWeek(now);
    if(period==="last-7-days") return new Date(now.getTime()-(7*24*60*60*1000));

    // Hard maximum for the Traps Added list.
    // Any unknown/missing value also falls back to 30 days.
    return new Date(now.getTime()-(30*24*60*60*1000));
  }

  function matchesSelectedPeriod(value){
    const d=asDate(value);
    if(!d) return false;
    const period=$("period-filter")?.value || "this-week";
    const start=periodStart(period);
    return !start || d>=start;
  }

  function selectedPeriodLabel(){
    const select=$("period-filter");
    return select?.options?.[select.selectedIndex]?.text || "This Week";
  }

  function cameraName(){
    return state.cameraFacing==="user" ? "Front" : "Back";
  }

  function updateCameraButtons(){
    const control=$("camera-control-btn");
    const close=$("camera-close-btn");
    const label=$("camera-current-label");
    if(!control) return;

    if(state.cameraRunning){
      control.textContent="🔄";
      control.setAttribute("aria-label",`Switch camera. Current: ${cameraName()} camera`);
      control.title=`Switch camera (currently ${cameraName()})`;
      close?.classList.remove("hidden");
      if(label){
        label.textContent=`${cameraName()} camera`;
        label.classList.remove("hidden");
      }
    }else{
      control.textContent="📷";
      control.setAttribute("aria-label",`Open ${cameraName().toLowerCase()} camera scanner`);
      control.title=`Open ${cameraName()} camera scanner`;
      close?.classList.add("hidden");
      label?.classList.add("hidden");
    }
  }
  const escapeSql = v => String(v).replace(/'/g,"''");
  const normalizeBarcode = v => String(v||"").trim().toUpperCase();

  function setStatus(kind,title,message){
    $("status-card").className=`status-card ${kind}`;
    $("status-icon").textContent=({neutral:"●",success:"✓",error:"✕",warning:"!"})[kind]||"●";
    $("status-title").textContent=title; $("status-message").textContent=message;
  }
  function setBusy(b){
    state.processing=b; $("barcode-input").disabled=b; $("camera-control-btn").disabled=b; $("refresh-btn").disabled=b;
  }
  function clearLastRecord(){
    $("last-record").classList.add("hidden");
    $("last-barcode").textContent="—";
    $("last-location").textContent="—";
    $("last-retrieved").textContent="—";
    $("last-field-tech").textContent="—";
    $("last-reviewed-by").textContent="—";
    $("last-freezer-time").textContent="—";
  }

  function updateLastRecord(a){
    $("last-record").classList.remove("hidden");
    $("last-barcode").textContent=a[f.barcode]??"—";
    $("last-location").textContent=a[f.location]??"—";
    $("last-retrieved").textContent=fmtDateTime(a[f.retrieved]);
    $("last-field-tech").textContent=a[f.fieldTech]??"—";
    $("last-reviewed-by").textContent=a[f.reviewedBy]??"—";
    $("last-freezer-time").textContent=fmtDateTime(a[f.freezerTime]);
  }
  const rowAttrs = r => r.attributes || r;

  function updateSortIndicators(){
    document.querySelectorAll(".sort-header").forEach(btn=>{
      const active=btn.dataset.sort===state.tableSort.key;
      const indicator=btn.querySelector(".sort-indicator");

      btn.classList.toggle("active",active);
      btn.setAttribute(
        "aria-sort",
        active
          ? (state.tableSort.direction==="asc" ? "ascending" : "descending")
          : "none"
      );

      if(indicator){
        indicator.textContent=active
          ? (state.tableSort.direction==="asc" ? "▲" : "▼")
          : "";
      }
    });
  }

  function renderTable(){
    const tbody=$("trap-table-body"), search=$("table-search").value.trim().toLowerCase();
    const sort=state.tableSort;
    let rows=state.todayRows.map(rowAttrs).filter(a=>matchesSelectedPeriod(a[f.freezerTime]));
    $("today-count").textContent=String(rows.length);
    $("period-count-label").textContent=selectedPeriodLabel();
    if(search) rows=rows.filter(a=>String(a[f.barcode]??"").toLowerCase().includes(search)||String(a[f.location]??"").toLowerCase().includes(search));
    rows.sort((a,b)=>{
      const freezerA=asDate(a[f.freezerTime])?.getTime()||0;
      const freezerB=asDate(b[f.freezerTime])?.getTime()||0;
      const retrievedA=asDate(a[f.retrieved])?.getTime()||0;
      const retrievedB=asDate(b[f.retrieved])?.getTime()||0;

      let cmp=0;

      switch(sort.key){
        case "barcode":
          cmp=String(a[f.barcode]??"").localeCompare(String(b[f.barcode]??""));
          break;
        case "location":
          cmp=String(a[f.location]??"").localeCompare(String(b[f.location]??""));
          break;
        case "retrieved":
          cmp=retrievedA-retrievedB;
          break;
        case "freezer":
          cmp=freezerA-freezerB;
          break;
        case "duration":
          // Longer freezer duration means an older Freezer Time.
          cmp=freezerB-freezerA;
          break;
        case "reviewedBy":
          cmp=String(a[f.reviewedBy]??"").localeCompare(String(b[f.reviewedBy]??""));
          break;
        default:
          cmp=freezerB-freezerA;
      }

      return sort.direction==="asc" ? cmp : -cmp;
    });

    updateSortIndicators();
    if(!rows.length){tbody.innerHTML='<tr><td colspan="6" class="empty-row">No matching freezer check-ins for this period.</td></tr>';return;}
    tbody.innerHTML="";
    rows.forEach(a=>{
      const tr=document.createElement("tr");
      [a[f.barcode]??"—",a[f.location]??"—",fmtShortTime(a[f.retrieved]),fmtShortTime(a[f.freezerTime]),durationText(a[f.freezerTime]),a[f.reviewedBy]??"—"]
      .forEach((v,i)=>{const td=document.createElement("td");td.textContent=v;if(i===4)td.className="duration";tr.appendChild(td);});
      tbody.appendChild(tr);
    });
  }

  function addTodayRecord(a){ state.todayRows.unshift({...a}); renderTable(); }

  async function waitForArcgis(){
    const start=Date.now();
    while(!window.$arcgis?.import){if(Date.now()-start>15000)throw new Error("ArcGIS Maps SDK did not load.");await new Promise(r=>setTimeout(r,100));}
  }

  async function initializeArcGIS(){
    await waitForArcgis();
    const [FeatureLayer,OAuthInfo,identityManager,Portal]=await window.$arcgis.import([
      "@arcgis/core/layers/FeatureLayer.js","@arcgis/core/identity/OAuthInfo.js",
      "@arcgis/core/identity/IdentityManager.js","@arcgis/core/portal/Portal.js"
    ]);
    state.identityManager=identityManager;
    identityManager.registerOAuthInfos([new OAuthInfo({appId:cfg.oauthAppId,portalUrl:cfg.portalUrl||"https://www.arcgis.com",popup:false})]);
    state.layer=new FeatureLayer({url:cfg.layerUrl,outFields:["*"]});
    await state.layer.load();

    try{
      const portal=new Portal({url:cfg.portalUrl||"https://www.arcgis.com"}); await portal.load();
      if(portal.user){
        state.currentUsername=portal.user.username||"";
        state.currentFullName=portal.user.fullName||"";
        $("user-label").textContent=state.currentFullName ? `${state.currentFullName} (${state.currentUsername})` : state.currentUsername;
        $("sign-out-btn").classList.remove("hidden");
      }
    }catch(_){}
    $("connection-label").textContent="Connected to ArcGIS"; $("sign-in-btn").classList.add("hidden");
    await loadTodayRows();
  }

  function setListLoading(isLoading,message="Loading freezer records…"){
    const overlay=$("list-loading-overlay");
    const text=$("list-loading-text");
    const refresh=$("refresh-btn");
    const period=$("period-filter");

    if(text) text.textContent=message;

    if(overlay){
      overlay.classList.toggle("hidden",!isLoading);
    }

    if(refresh){
      refresh.disabled=isLoading;
      refresh.classList.toggle("loading",isLoading);
      refresh.textContent=isLoading ? "Loading…" : "Refresh";
    }

    if(period){
      period.disabled=isLoading;
    }
  }

  async function loadTodayRows(){
    if(state.demo){
      setListLoading(true,"Loading demo records…");
      await new Promise(r=>setTimeout(r,250));
      state.todayRows=demoRows.map(x=>({...x}));
      renderTable();
      setListLoading(false);
      return;
    }

    setListLoading(true,"Loading freezer records…");

    try{
      const q=state.layer.createQuery();
    const period=$("period-filter")?.value || "this-week";
    const start=periodStart(period);

    // The Traps Added list ONLY contains records that already have
    // a Freezer Time (REVIEWEDDATE), and never queries more than 30 days.
    const startUtc=formatArcgisUtcTimestamp(start);
    q.where=`${f.freezerTime} IS NOT NULL AND ${f.freezerTime} >= TIMESTAMP '${startUtc}'`;

    q.outFields=[state.layer.objectIdField,f.barcode,f.activity,f.retrieved,f.location,f.zone,f.fieldTech,f.reviewedBy,f.freezerTime].filter(Boolean);
    q.returnGeometry=false;
    q.orderByFields=[`${f.freezerTime} DESC`];
    q.num=Number(cfg.recentLimit||1000);
      state.todayRows=(await state.layer.queryFeatures(q)).features;
      renderTable();
    }finally{
      setListLoading(false);
    }
  }

  async function liveCheckIn(barcode){
    // v1.2 rule: Barcode is the only lookup/validation key.
    // 0 matches  -> barcode not found
    // 1 match + REVIEWEDDATE already set -> show existing freezer event, do not edit
    // 1 match + REVIEWEDDATE null -> set REVIEWEDDATE + REVIEWEDBY from configured Creator field
    // >1 matches -> duplicate-barcode safety stop
    const q=state.layer.createQuery();
    q.where=`${f.barcode} = '${escapeSql(barcode)}'`;
    q.outFields=[
      state.layer.objectIdField,
      f.barcode,
      f.activity,
      f.retrieved,
      f.location,
      f.zone,
      f.fieldTech,
      f.creator,
      f.reviewedBy,
      f.freezerTime
    ].filter(Boolean);
    q.returnGeometry=false;

    const result=await state.layer.queryFeatures(q);

    if(result.features.length===0){
      throw new Error("Barcode was not found in TrapData.");
    }

    if(result.features.length>1){
      throw new Error("More than one TrapData record has this barcode. Nothing was changed.");
    }

    const feature=result.features[0];
    const attrs=feature.attributes;

    if(attrs[f.freezerTime]){
      return {
        status:"already",
        attributes:attrs
      };
    }

    // A trap is eligible for freezer check-in only after it has been Retrieved.
    // We require both the stored Retrieve activity code and a Retrieve timestamp.
    const activityValue=String(attrs[f.activity]??"").trim().toUpperCase();
    const retrievedDate=asDate(attrs[f.retrieved]);

    if(activityValue!==String(cfg.retrievedValue||"R").trim().toUpperCase() || !retrievedDate){
      return {
        status:"notRetrieved",
        attributes:attrs
      };
    }

    if(!f.creator){
      throw new Error("Creator field is not configured in config.js.");
    }

    const trapCreator=String(attrs[f.creator]??"").trim();
    if(!trapCreator){
      throw new Error(`Configured Creator field ${f.creator} is blank. Nothing was changed.`);
    }

    attrs[f.freezerTime]=new Date();
    attrs[f.reviewedBy]=trapCreator;

    const edits=await state.layer.applyEdits({updateFeatures:[feature]});
    const er=edits.updateFeatureResults?.[0];

    if(!er){
      throw new Error("ArcGIS did not return an update result.");
    }

    if(er.error){
      throw new Error(er.error.message||"ArcGIS rejected the update.");
    }

    return {
      status:"saved",
      attributes:attrs
    };
  }

  async function demoCheckIn(barcode){
    await new Promise(r=>setTimeout(r,350));
    const existing=demoRows.find(a=>normalizeBarcode(a[f.barcode])===barcode);
    if(existing){
      return {status:"already",attributes:existing};
    }

    const attrs={
      [f.barcode]:barcode,[f.activity]:cfg.retrievedValue||"R",[f.retrieved]:new Date(Date.now()-5400000),
      [f.location]:`SITE-${String(Math.floor(Math.random()*30)+1).padStart(3,"0")}`,
      [f.zone]:String(Math.floor(Math.random()*5)+1),[f.fieldTech]:"Demo Tech",[f.reviewedBy]:"demo_creator",[f.freezerTime]:new Date()
    };
    demoRows.unshift(attrs);
    return {status:"saved",attributes:attrs};
  }

  async function processBarcode(raw,source="input"){
    const barcode=normalizeBarcode(raw); if(!barcode||state.processing)return;
    if(source==="camera"&&barcode===state.lastScannedBarcode&&Date.now()-state.lastScanAt<5000)return;
    state.lastScannedBarcode=barcode; state.lastScanAt=Date.now(); setBusy(true);
    clearLastRecord();
    setStatus("neutral","Checking…",`Validating ${barcode}`);
    try{
      const result=state.demo?await demoCheckIn(barcode):await liveCheckIn(barcode);
      const a=result.attributes;

      updateLastRecord(a);
      const infoGroup=$("scan-info-group");
      if(infoGroup) infoGroup.open=true;

      if(result.status==="already"){
        const who=a[f.reviewedBy] ? ` by ${a[f.reviewedBy]}` : "";
        setStatus(
          "warning",
          "ALREADY IN FREEZER",
          `${barcode} was freezer-checked at ${fmtDateTime(a[f.freezerTime])}${who}. No changes were made.`
        );
        $("barcode-input").value="";
        return;
      }

      if(result.status==="notRetrieved"){
        setStatus(
          "error",
          "NOT RETRIEVED",
          `${barcode} exists, but it has not been marked Retrieved with a Retrieve time. It was not added to the freezer.`
        );
        $("barcode-input").value="";
        return;
      }

      addTodayRecord(a);

      setStatus(
        "success",
        "VALID — SAVED",
        `${barcode} was freezer-checked at ${fmtShortTime(a[f.freezerTime])}.`
      );
      $("barcode-input").value="";
      if(navigator.vibrate)navigator.vibrate(80);
    }catch(err){
      console.error(err);
      const reason=err.message||"Unknown error.";
      setStatus("error","NOT CHECKED IN",`${barcode}: ${reason}`);
      const infoGroup=$("scan-info-group");
      if(infoGroup) infoGroup.open=true;
    }
    finally{setBusy(false);$("barcode-input").focus();}
  }

  async function startCamera(){
    if(state.cameraRunning || state.cameraSwitching) return;
    if(!window.Html5Qrcode){
      setStatus("error","Camera unavailable","Barcode scanner library did not load.");
      return;
    }

    try{
      $("camera-wrap").classList.remove("hidden");
      const formats=[],F=window.Html5QrcodeSupportedFormats;
      if(F)[F.CODE_128,F.QR_CODE,F.DATA_MATRIX].forEach(x=>{if(x!==undefined)formats.push(x);});

      state.scanner=new Html5Qrcode("camera-reader",{
        formatsToSupport:formats.length?formats:undefined,
        experimentalFeatures:{useBarCodeDetectorIfSupported:false}
      });

      await state.scanner.start(
        {facingMode:state.cameraFacing},
        {fps:10,qrbox:{width:300,height:130},aspectRatio:1.777778},
        async decoded=>{
          if(state.cameraDecodeLocked) return;
          state.cameraDecodeLocked=true;
          await stopCamera();
          await processBarcode(decoded,"camera");
        },
        ()=>{}
      );

      state.cameraRunning=true;
      state.cameraDecodeLocked=false;
      updateCameraButtons();
      setStatus("neutral",`${cameraName()} camera ready`,"Scan a trap barcode.");
    }catch(err){
      console.error(err);
      state.scanner=null;
      state.cameraRunning=false;
      state.cameraDecodeLocked=false;
      $("camera-wrap").classList.add("hidden");
      updateCameraButtons();
      setStatus("error","Camera could not start","Allow camera access in Safari/iPad settings, then try again.");
    }
  }

  async function stopCamera(keepPanel=false){
    if(state.scanner){
      try{
        if(state.cameraRunning) await state.scanner.stop();
        state.scanner.clear();
      }catch(_){}
    }

    state.scanner=null;
    state.cameraRunning=false;
    state.cameraDecodeLocked=false;

    if(!keepPanel){
      $("camera-wrap").classList.add("hidden");
    }
    updateCameraButtons();
  }

  async function switchCamera(){
    if(!state.cameraRunning || state.cameraSwitching) return;
    state.cameraSwitching=true;

    try{
      await stopCamera(true);
      state.cameraFacing=state.cameraFacing==="user" ? "environment" : "user";
      try{localStorage.setItem("fieldseekerFreezerCameraFacing",state.cameraFacing);}catch(_){}
      setStatus("neutral","Switching camera…",`Opening ${cameraName().toLowerCase()} camera.`);
      state.cameraSwitching=false;
      await startCamera();
    }catch(err){
      console.error(err);
      state.cameraSwitching=false;
      await stopCamera();
      setStatus("error","Could not switch camera",err.message||"Try opening the camera again.");
    }
  }

  async function cameraControl(){
    if(state.cameraRunning){
      await switchCamera();
    }else{
      await startCamera();
    }
  }

  function wireEvents(){
    $("barcode-input").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();processBarcode(e.currentTarget.value);}});
    $("camera-control-btn").addEventListener("click",cameraControl);
    $("camera-close-btn").addEventListener("click",()=>stopCamera());
    $("refresh-btn").addEventListener("click",async()=>{try{await loadTodayRows();setStatus("neutral","Ready","List refreshed.");}catch(err){setStatus("error","Refresh failed",err.message||"Could not refresh.");}});
    $("table-search").addEventListener("input",renderTable);

    document.querySelectorAll(".sort-header").forEach(btn=>{
      btn.addEventListener("click",()=>{
        const key=btn.dataset.sort;

        if(state.tableSort.key===key){
          state.tableSort.direction=state.tableSort.direction==="asc" ? "desc" : "asc";
        }else{
          state.tableSort.key=key;

          // Natural defaults for a newly selected column.
          if(key==="barcode" || key==="location" || key==="reviewedBy"){
            state.tableSort.direction="asc";
          }else{
            state.tableSort.direction="desc";
          }
        }

        renderTable();
      });
    });

    $("period-filter").addEventListener("change",async()=>{
      try{
        setStatus("neutral","Loading…",`Loading ${selectedPeriodLabel().toLowerCase()} freezer check-ins.`);
        await loadTodayRows();
        setStatus("neutral","Ready","Period filter updated.");
      }catch(err){
        setStatus("error","Filter failed",err.message||"Could not load this period.");
      }
    });
    $("sign-out-btn").addEventListener("click",()=>{state.identityManager?.destroyCredentials();location.reload();});
    $("sign-in-btn").addEventListener("click",async()=>{try{await initializeArcGIS();setStatus("neutral","Ready","Scan the first trap.");}catch(err){setStatus("error","Sign-in failed",err.message||"Could not sign in.");}});
    setInterval(renderTable,30000);
  }

  async function init(){
    $("app-title").textContent=cfg.appTitle||"Lab Freezer Scanner";
    try{
      const savedFacing=localStorage.getItem("fieldseekerFreezerCameraFacing");
      if(savedFacing==="user" || savedFacing==="environment") state.cameraFacing=savedFacing;
    }catch(_){}
    $("period-filter").value="this-week";
    updateCameraButtons();
    wireEvents();
    if(!configured()&&cfg.demoWhenUnconfigured!==false){
      state.demo=true;$("demo-banner").classList.remove("hidden");$("connection-label").textContent="Demo mode";
      state.todayRows=demoRows.map(x=>({...x}));renderTable();setStatus("neutral","Demo ready","Type any barcode or open the camera scanner.");return;
    }
    $("connection-label").textContent="Connecting to ArcGIS…";
    try{await initializeArcGIS();setStatus("neutral","Ready","Scan the first trap.");}
    catch(err){console.error(err);$("connection-label").textContent="ArcGIS sign-in required";$("sign-in-btn").classList.remove("hidden");
      setStatus("warning","Sign in to ArcGIS","Use the Sign in button before scanning traps.");}
  }
  init();
})();
