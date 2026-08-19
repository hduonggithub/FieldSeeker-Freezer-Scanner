(() => {
  "use strict";
  const cfg = window.FREEZER_APP_CONFIG || {};
  const f = cfg.fields || {};
  const $ = id => document.getElementById(id);

  const state = {
    demo:false, layer:null, identityManager:null, scanner:null, cameraRunning:false, cameraDecodeLocked:false,
    processing:false, sessionCount:0, todayRows:[], lastScannedBarcode:"", lastScanAt:0,
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
  const escapeSql = v => String(v).replace(/'/g,"''");
  const normalizeBarcode = v => String(v||"").trim().toUpperCase();

  function setStatus(kind,title,message){
    $("status-card").className=`status-card ${kind}`;
    $("status-icon").textContent=({neutral:"●",success:"✓",error:"✕",warning:"!"})[kind]||"●";
    $("status-title").textContent=title; $("status-message").textContent=message;
  }
  function setBusy(b){
    state.processing=b; $("submit-barcode-btn").disabled=b; $("barcode-input").disabled=b; $("refresh-btn").disabled=b;
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

  function renderTable(){
    const tbody=$("trap-table-body"), search=$("table-search").value.trim().toLowerCase(), sort=$("sort-select").value;
    let rows=state.todayRows.map(rowAttrs).filter(a=>sameLocalDay(a[f.freezerTime]));
    $("today-count").textContent=String(rows.length);
    if(search) rows=rows.filter(a=>String(a[f.barcode]??"").toLowerCase().includes(search)||String(a[f.location]??"").toLowerCase().includes(search));
    rows.sort((a,b)=>{
      const fa=asDate(a[f.freezerTime])?.getTime()||0, fb=asDate(b[f.freezerTime])?.getTime()||0;
      if(sort==="freezer-asc"||sort==="duration-desc") return fa-fb;
      if(sort==="duration-asc"||sort==="freezer-desc") return fb-fa;
      if(sort==="barcode-asc") return String(a[f.barcode]??"").localeCompare(String(b[f.barcode]??""));
      if(sort==="location-asc") return String(a[f.location]??"").localeCompare(String(b[f.location]??""));
      return fb-fa;
    });
    if(!rows.length){tbody.innerHTML='<tr><td colspan="6" class="empty-row">No matching freezer check-ins today.</td></tr>';return;}
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

  async function loadTodayRows(){
    if(state.demo){state.todayRows=demoRows.map(x=>({...x}));renderTable();return;}
    const q=state.layer.createQuery();
    q.where=`${f.freezerTime} IS NOT NULL`;
    q.outFields=[state.layer.objectIdField,f.barcode,f.activity,f.retrieved,f.location,f.zone,f.fieldTech,f.reviewedBy,f.freezerTime].filter(Boolean);
    q.returnGeometry=false; q.orderByFields=[`${f.freezerTime} DESC`]; q.num=Number(cfg.recentLimit||500);
    state.todayRows=(await state.layer.queryFeatures(q)).features; renderTable();
  }

  async function liveCheckIn(barcode){
    // v1.2 rule: Barcode is the only lookup/validation key.
    // 0 matches  -> barcode not found
    // 1 match + REVIEWEDDATE already set -> show existing freezer event, do not edit
    // 1 match + REVIEWEDDATE null -> set REVIEWEDDATE + REVIEWEDBY
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

    if(!state.currentUsername){
      throw new Error("Signed-in ArcGIS username could not be determined.");
    }

    attrs[f.freezerTime]=new Date();
    attrs[f.reviewedBy]=state.currentUsername;

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
      [f.zone]:String(Math.floor(Math.random()*5)+1),[f.fieldTech]:"Demo Tech",[f.reviewedBy]:"demo_user",[f.freezerTime]:new Date()
    };
    demoRows.unshift(attrs);
    return {status:"saved",attributes:attrs};
  }

  async function processBarcode(raw,source="input"){
    const barcode=normalizeBarcode(raw); if(!barcode||state.processing)return;
    if(source==="camera"&&barcode===state.lastScannedBarcode&&Date.now()-state.lastScanAt<5000)return;
    state.lastScannedBarcode=barcode; state.lastScanAt=Date.now(); setBusy(true);
    setStatus("neutral","Checking…",`Validating ${barcode}`);
    try{
      const result=state.demo?await demoCheckIn(barcode):await liveCheckIn(barcode);
      const a=result.attributes;

      updateLastRecord(a);

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

      state.sessionCount++;
      $("session-count").textContent=String(state.sessionCount);
      addTodayRecord(a);

      setStatus(
        "success",
        "VALID — SAVED",
        `${barcode} was freezer-checked at ${fmtShortTime(a[f.freezerTime])}.`
      );
      $("barcode-input").value="";
      if(navigator.vibrate)navigator.vibrate(80);
    }catch(err){console.error(err);setStatus("error","NOT CHECKED IN",err.message||"Unknown error.");}
    finally{setBusy(false);$("barcode-input").focus();}
  }

  async function startCamera(){
    if(state.cameraRunning)return;
    if(!window.Html5Qrcode){setStatus("error","Camera unavailable","Barcode scanner library did not load.");return;}
    try{
      $("camera-wrap").classList.remove("hidden");$("camera-start-btn").classList.add("hidden");$("camera-stop-btn").classList.remove("hidden");
      const formats=[],F=window.Html5QrcodeSupportedFormats;
      if(F)[F.CODE_128,F.QR_CODE,F.DATA_MATRIX].forEach(x=>{if(x!==undefined)formats.push(x);});
      state.scanner=new Html5Qrcode("camera-reader",{formatsToSupport:formats.length?formats:undefined,
        experimentalFeatures:{useBarCodeDetectorIfSupported:false}});
      await state.scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:300,height:130},aspectRatio:1.777778},
        async decoded=>{
          if(state.cameraDecodeLocked) return;
          state.cameraDecodeLocked=true;

          // Close immediately after ANY barcode is decoded so the result
          // panel is visible whether the code is valid, invalid, duplicate,
          // or already checked into the freezer.
          await stopCamera();
          await processBarcode(decoded,"camera");
        },()=>{});
      state.cameraRunning=true;
      state.cameraDecodeLocked=false;
      setStatus("neutral","Camera ready","Scan a trap barcode.");
    }catch(err){
      console.error(err);$("camera-wrap").classList.add("hidden");$("camera-start-btn").classList.remove("hidden");$("camera-stop-btn").classList.add("hidden");
      setStatus("error","Camera could not start","Allow camera access in Safari/iPad settings, then try again.");
    }
  }

  async function stopCamera(){
    if(!state.scanner)return;
    try{if(state.cameraRunning)await state.scanner.stop();state.scanner.clear();}catch(_){}
    state.scanner=null;
    state.cameraRunning=false;
    state.cameraDecodeLocked=false;
    $("camera-wrap").classList.add("hidden");
    $("camera-start-btn").classList.remove("hidden");
    $("camera-stop-btn").classList.add("hidden");
  }

  function wireEvents(){
    $("submit-barcode-btn").addEventListener("click",()=>processBarcode($("barcode-input").value));
    $("barcode-input").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();processBarcode(e.currentTarget.value);}});
    $("camera-start-btn").addEventListener("click",startCamera);$("camera-stop-btn").addEventListener("click",stopCamera);
    $("refresh-btn").addEventListener("click",async()=>{try{await loadTodayRows();setStatus("neutral","Ready","List refreshed.");}catch(err){setStatus("error","Refresh failed",err.message||"Could not refresh.");}});
    $("table-search").addEventListener("input",renderTable);$("sort-select").addEventListener("change",renderTable);
    $("sign-out-btn").addEventListener("click",()=>{state.identityManager?.destroyCredentials();location.reload();});
    $("sign-in-btn").addEventListener("click",async()=>{try{await initializeArcGIS();setStatus("neutral","Ready","Scan the first trap.");}catch(err){setStatus("error","Sign-in failed",err.message||"Could not sign in.");}});
    setInterval(renderTable,30000);
  }

  async function init(){
    $("app-title").textContent=cfg.appTitle||"Lab Freezer Scanner";wireEvents();
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
