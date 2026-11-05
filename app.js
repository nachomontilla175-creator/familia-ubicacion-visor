/* Mi Ubicación 2.0. No analytics, no token in URLs, no HTML from remote data. */
(() => {
  'use strict';
  const C=window.FamilyCore,$=id=>document.getElementById(id);
  const icons={
    map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8.5 11 2.5 2.5 4.5-4.5"/>',
    settings:'<path d="m10 3-.7 2.3-2 .9L5 5.5 3 9l1.6 1.7v2.6L3 15l2 3.5 2.3-.7 2 .9L10 21h4l.7-2.3 2-.9 2.3.7 2-3.5-1.6-1.7v-2.6L21 9l-2-3.5-2.3.7-2-.9L14 3z"/><circle cx="12" cy="12" r="3"/>',
    refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 6a8 8 0 0 1 13 2M18 18a8 8 0 0 1-13-2"/>',
    spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 18h2"/>',
    locate:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    pin:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    route:'<circle cx="6" cy="5" r="2"/><circle cx="18" cy="19" r="2"/><path d="M6 7v8a4 4 0 0 0 8 0V9a4 4 0 0 1 8 0v3"/>',
    signal:'<path d="M4 20v-3M9 20v-7M14 20V9M19 20V4"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
    battery:'<rect x="3" y="6" width="16" height="12" rx="2"/><path d="M21 10v4M6 9v6M9 9v6M12 9v6"/>'
  };
  const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.pin}</svg>`;
  document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=svg(el.dataset.icon);});
  const state={demo:true,config:null,members:[],selected:'',latest:new Map(),status:new Map(),points:[],errors:new Map(),map:null,layer:null,controller:null,version:0,limit:8,lastDay:C.today(),cooldown:0,fit:true};
  const colors=['#dbead8','#e7dff0','#f0e6d2','#dce9ec','#eddbd8'];
  let toastTimer;
  function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('toast').hidden=true;},4500);}
  function notice(message=''){$('notice').textContent=message;$('notice').hidden=!message;}
  function time(p){return new Intl.DateTimeFormat('es-AR',{hour:'2-digit',minute:'2-digit'}).format(new Date(p.t));}
  function fullTime(p){return new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(p.t));}
  const initials=name=>name.split(/[\s-]+/).map(s=>s[0]||'').join('').slice(0,2).toUpperCase();
  function node(tag,className,text){const el=document.createElement(tag);if(className)el.className=className;if(text!==undefined)el.textContent=text;return el;}
  function avatar(member,p){const el=node('span',`avatar ${C.freshness(p).kind}`,initials(member.label));el.style.background=colors[state.members.findIndex(m=>m.id===member.id)%colors.length];return el;}
  function selected(){return state.members.find(m=>m.id===state.selected)||state.members[0];}
  function saveStorage(config,remember){
    localStorage.removeItem('family_location_v2');sessionStorage.removeItem('family_location_v2');
    (remember?localStorage:sessionStorage).setItem('family_location_v2',JSON.stringify(config));
    localStorage.removeItem('visor_ubicacion_cfg');
  }
  function stored(){
    try{
      const c=JSON.parse(sessionStorage.getItem('family_location_v2')||localStorage.getItem('family_location_v2')||'null');
      if(c&&/^[A-Za-z0-9-]+$/.test(c.owner)&&/^[A-Za-z0-9_.-]+$/.test(c.repo)&&typeof c.token==='string'&&Array.isArray(c.members)){
        c.members=c.members.filter(m=>typeof m.id==='string'&&C.slug(m.id)===m.id&&typeof m.label==='string').slice(0,10);
        if(c.members.length&&c.token)return c;
      }
    }catch{/* An inaccessible browser store never prevents demonstration mode. */}
    return null;
  }
  function setMode(config=null){
    state.controller?.abort();state.version++;state.config=config;state.demo=!config;state.latest.clear();state.status.clear();state.errors.clear();state.points=[];
    state.members=config?.members||[{id:'sofia',label:'Sofía'},{id:'mateo',label:'Mateo'},{id:'papa',label:'Papá'}];
    state.selected=state.members[0].id;state.limit=8;state.cooldown=0;state.fit=true;
    $('demo-banner').hidden=!state.demo;$('map-demo-label').hidden=!state.demo;
    $('mode-pill').textContent=state.demo?'Demostración':'Espacio privado';$('mode-pill').classList.toggle('real',!state.demo);
    $('member-count').textContent=String(state.members.length);
    $('date-pick').value=C.today();state.lastDay=C.today();notice();render();load(true);
  }
  function demoData(){
    const date=$('date-pick').value;
    const now=Date.now();
    const index=state.members.findIndex(m=>m.id===state.selected);
    const base=date===C.today()?now-[2,8,42][index]*60000:new Date(`${date}T17:30:00`).getTime();
    const route=[[-31.5400,-68.5415],[-31.5378,-68.5415],[-31.5355,-68.5415],[-31.5333,-68.5414],[-31.5314,-68.5413],[-31.5313,-68.5388],[-31.5313,-68.5361],[-31.5313,-68.5336],[-31.5312,-68.5310],[-31.5311,-68.5285],[-31.5333,-68.5285],[-31.5350,-68.5285],[-31.5366,-68.5284],[-31.5366,-68.5258],[-31.5366,-68.5232]];
    const points=route.map(([lat,lon],i)=>({id:`demo-${date}-${index}-${i}`,lat:lat+index*.002,lon:lon-index*.005,t:new Date(base-(route.length-1-i)*300000).toISOString(),acc:12+(i%5)*3,battery:84-Math.floor(i/3),interval:5,address:`Avenida de ejemplo ${100+i*20}, Ciudad de muestra`,address_scope:'nearby'}));
    for(const [i,member] of state.members.entries()){
      const r=route[route.length-1],minutes=[2,8,42][i];
      state.latest.set(member.id,{lat:r[0]+i*.002,lon:r[1]-i*.005,t:new Date(now-minutes*60000).toISOString(),acc:18+i*5,battery:80-i*13,interval:5,address:'Avenida de ejemplo 380, Ciudad de muestra',address_scope:'nearby'});
    }
    return points;
  }
  function initMap(){
    if(!window.L){$('map-unavailable').hidden=false;return;}
    state.map=L.map('map',{zoomControl:false,scrollWheelZoom:false}).setView([-31.534,-68.532],14);
    L.control.zoom({position:'topright'}).addTo(state.map);
    const tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>'}).addTo(state.map);
    let errors=0;
    tiles.on('tileerror',()=>{errors++;if(errors>3)toast('El mapa no está cargando. Revisá la conexión a internet.');});
    tiles.on('tileload',()=>{errors=0;});state.layer=L.layerGroup().addTo(state.map);
  }
  async function api(path,signal,raw=false){
    const c=state.config;
    const res=await fetch(`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}${path}`,{
      signal,cache:'no-store',headers:{Authorization:`Bearer ${c.token}`,Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}
    });
    if(res.status===404&&(raw||path==='/contents/data'))return null;
    if(!res.ok){
      if(res.status===403||res.status===429){
        const wait=Number(res.headers.get('Retry-After'));
        const reset=Number(res.headers.get('X-RateLimit-Reset'))*1000;
        state.cooldown=Math.max(Date.now()+60000,wait?Date.now()+wait*1000:0,reset||0);
      }
      throw new Error(({401:'El token venció o no es válido. Actualizalo en Configuración.',403:'GitHub rechazó el acceso o limitó las consultas. Revisá los permisos; pausamos las actualizaciones automáticas.',404:'No se encuentra el repositorio privado. Revisá el usuario, el nombre y el acceso del token.',429:'GitHub pidió esperar antes de actualizar.'})[res.status]||`GitHub no está disponible (HTTP ${res.status}).`);
    }
    return res.json();
  }
  const file=(child,name,signal)=>api(`/contents/data/${encodeURIComponent(child)}/${encodeURIComponent(name)}`,signal,true);
  async function load(fit=false){
    if(document.hidden)return;
    if(!state.demo&&Date.now()<state.cooldown){toast('Esperá un momento antes de volver a consultar GitHub.');return;}
    state.controller?.abort();const controller=new AbortController();state.controller=controller;
    const version=++state.version;let target=state.selected;const date=$('date-pick').value;
    state.fit=fit;$('refresh').classList.add('loading');$('refresh').disabled=true;
    const timeout=setTimeout(()=>controller.abort('timeout'),25000);
    try{
      if(state.demo){state.points=demoData();notice();}
      else{
        const metadata=await api('',controller.signal);
        if(!metadata.private)throw new Error('Este repositorio es público. Usá uno privado para proteger las ubicaciones.');
        const directory=await api('/contents/data',controller.signal);
        if(version!==state.version)return;
        const discovered=C.memberDirectories(directory,state.config.members);
        if(discovered.length){
          state.members=discovered;
          if(!discovered.some(m=>m.id===state.selected)){state.selected=discovered[0].id;state.points=[];state.limit=8;state.fit=true;}
          target=state.selected;$('member-count').textContent=String(state.members.length);
        }
        const results=await Promise.allSettled([
          file(target,`${date}.json`,controller.signal),
          ...state.members.map(m=>file(m.id,'latest.json',controller.signal)),
          ...state.members.map(m=>file(m.id,'status.json',controller.signal))
        ]);
        if(version!==state.version)return;
        const history=results[0];state.errors.clear();
        if(history.status==='fulfilled')state.points=C.cleanPoints(history.value||[]);
        else throw history.reason;
        results.slice(1,1+state.members.length).forEach((result,i)=>{
          const id=state.members[i].id;
          if(result.status==='fulfilled')state.latest.set(id,C.validPoint(result.value)?result.value:null);
          else state.errors.set(id,result.reason.message||'No se pudo actualizar');
        });
        results.slice(1+state.members.length).forEach((result,i)=>{
          const id=state.members[i].id;
          if(result.status==='fulfilled'){
            const report=result.value&&!Array.isArray(result.value)?result.value:null;
            state.status.set(id,report);
            if(report&&typeof report.label==='string'&&report.label.trim().length>0&&report.label.trim().length<=40)state.members[i].label=report.label.trim();
          }
          else state.errors.set(id,result.reason.message||'No se pudo actualizar el estado');
        });
        notice(state.errors.size?'No se pudieron actualizar algunos familiares. Mostramos la última información recibida.':'');
      }
      if(version!==state.version)return;
      $('last-refresh').textContent=state.demo?'Datos de ejemplo · No son ubicaciones reales':`${state.errors.size?'Actualización parcial':'Actualizado'} · ${new Intl.DateTimeFormat('es-AR',{hour:'2-digit',minute:'2-digit'}).format(new Date())}`;
      render();
    }catch(e){
      if(version!==state.version)return;
      if(controller.signal.aborted&&controller.signal.reason!=='timeout')return;
      notice(controller.signal.reason==='timeout'?'La conexión tardó demasiado. Se conserva la última información recibida.':`${e.message||'No se pudo actualizar.'} Se conserva la última información recibida.`);
      render();
    }finally{clearTimeout(timeout);if(version===state.version){$('refresh').classList.remove('loading');$('refresh').disabled=false;}}
  }
  function select(id){if(state.selected===id)return;state.selected=id;state.points=[];state.limit=8;state.fit=true;render();load(true);}
  function renderMembers(){
    const fragment=document.createDocumentFragment();
    for(const member of state.members){
      const p=state.latest.get(member.id),status=C.deviceState(state.status.get(member.id),p);
      const b=node('button',`member ${state.selected===member.id?'current':''}`);b.type='button';b.setAttribute('aria-pressed',String(state.selected===member.id));
      b.append(avatar(member,p));const info=node('span','member-info');info.append(node('span','member-name',member.label),node('span','member-state',state.errors.has(member.id)?'No se pudo actualizar':status.short));b.append(info,node('span','member-chevron','›'));b.addEventListener('click',()=>select(member.id));fragment.append(b);
    }
    $('members').replaceChildren(fragment);
  }
  function renderLocation(){
    const member=selected();if(!member)return;
    const historical=$('date-pick').value!==C.today();
    const p=historical?state.points[state.points.length-1]:state.latest.get(member.id);
    const status=C.freshness(p),health=C.deviceState(state.status.get(member.id),p),card=$('location-card');card.replaceChildren();
    const top=node('div','location-top');top.append(avatar(member,p));const who=node('div');who.append(node('div','location-name',member.label),node('div','location-time',p?fullTime(p):'Todavía sin registros'));top.append(who,node('span',`status-tag ${status.kind!=='fresh'?'old':''}`,historical?'Historial':status.kind==='fresh'?'Reciente':status.kind==='unknown'?'Sin datos':'Sin señal reciente'));card.append(top,node('div','location-separator'));
    const caption=node('div','location-caption');
    caption.append(node('strong','',historical?'Último punto de la fecha':health.title));
    const address=C.addressLabel(p);
    const addressName=node('strong','automatic-address',address||'Dirección todavía no disponible');addressName.title=address;caption.append(addressName);
    if(address)caption.append(node('small','',p.address_scope==='area'?'Zona aproximada según el GPS':'Dirección aproximada según el GPS'));
    caption.append(node('span','',p?`${p.lat.toFixed(5)}, ${p.lon.toFixed(5)} · ±${Math.round(Number(p.acc)||0)} m`:'Al iniciar el seguimiento aparecerá acá.'));card.append(caption);
    if(p){const bottom=node('div','location-bottom');const battery=node('span');battery.innerHTML=svg('battery');battery.append(document.createTextNode(Number.isFinite(p.battery)&&p.battery>=0?`${p.battery}% batería`:'Sin dato de batería'));bottom.append(battery);const link=node('a','','Abrir mapa ↗');link.href=`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=16/${p.lat}/${p.lon}`;link.target='_blank';link.rel='noopener noreferrer';bottom.append(link);card.append(bottom);}
  }
  function renderMap(){
    if(!state.map)return;state.layer.clearLayers();
    const historical=$('date-pick').value!==C.today(),bounds=[];
    for(const group of C.segments(state.points)){
      const coords=group.map(p=>[p.lat,p.lon]);bounds.push(...coords);
      if(coords.length>1){L.polyline(coords,{color:'#fff',weight:7,opacity:.9}).addTo(state.layer);L.polyline(coords,{color:'#5d8b55',weight:3.5,opacity:.95,lineCap:'round'}).addTo(state.layer);}
    }
    if(state.points.length){const first=state.points[0];L.marker([first.lat,first.lon],{icon:L.divIcon({className:'person-marker',html:'<div class="start-marker"></div>',iconSize:[11,11]})}).addTo(state.layer).bindTooltip('Inicio del recorrido');}
    const shown=historical?[{member:selected(),p:state.points[state.points.length-1]}]:state.members.map(member=>({member,p:state.latest.get(member.id)}));
    for(const {member,p} of shown){
      if(!p)continue;const active=member.id===state.selected;
      if(active){bounds.push([p.lat,p.lon]);if(Number.isFinite(p.acc)&&p.acc>0)L.circle([p.lat,p.lon],{radius:Math.min(p.acc,10000),color:'#8cb47a',weight:1,fillColor:'#8ab577',fillOpacity:.14}).addTo(state.layer);}
      const marker=node('div',`map-avatar ${active?'active':''} ${C.freshness(p).kind==='stale'?'old':''}`,initials(member.label));
      L.marker([p.lat,p.lon],{icon:L.divIcon({className:'person-marker',html:marker,iconSize:[39,39],iconAnchor:[19,19]}),zIndexOffset:active?100:0}).addTo(state.layer).bindTooltip(node('span','',`${member.label} · ${C.ageLabel(p)}`)).on('click',()=>select(member.id));
    }
    if(state.fit&&bounds.length){state.map.invalidateSize();state.map.fitBounds(bounds,{paddingTopLeft:[30,45],paddingBottomRight:[30,45],maxZoom:15});state.fit=false;}
  }
  function renderTimeline(){
    const points=[...state.points].reverse(),fragment=document.createDocumentFragment();
    if(!points.length)fragment.append(node('div','empty-state',state.demo?'No hay datos de ejemplo para esta fecha.':'Sin registros para esta fecha. Verificá el nombre del teléfono o elegí otro día.'));
    points.slice(0,state.limit).forEach((p,i)=>{
      const row=node('button','timeline-row');row.type='button';row.setAttribute('aria-label',`Centrar ubicación de las ${time(p)}`);
      row.append(node('span','timeline-time',time(p)),node('span','timeline-dot'));
      const address=C.addressLabel(p),info=node('span','timeline-content');
      info.append(node('strong','',address||'Dirección todavía no disponible'),node('small','',`${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}${address?` · ${p.address_scope==='area'?'Zona aproximada':'Dirección aproximada'}`:''}`));row.append(info);
      const acc=node('span','timeline-accuracy');acc.innerHTML=svg('locate');acc.append(document.createTextNode(Number.isFinite(p.acc)?`±${Math.round(p.acc)} m`:'Sin precisión'));row.append(acc);
      row.addEventListener('click',()=>{if(state.map){state.map.setView([p.lat,p.lon],17);$('map').scrollIntoView({behavior:reducedMotion()?'instant':'smooth',block:'center'});}});fragment.append(row);
    });
    $('timeline').replaceChildren(fragment);$('show-more').hidden=points.length<=state.limit;$('export').disabled=!points.length;
  }
  function render(){
    renderMembers();const member=selected();if(!member)return;
    $('map-title').textContent=`Recorrido de ${member.label}`;
    $('map-subtitle').textContent=$('date-pick').value===C.today()?'Hoy':new Intl.DateTimeFormat('es-AR',{day:'numeric',month:'short'}).format(new Date(`${$('date-pick').value}T12:00:00`));
    renderLocation();renderMap();renderTimeline();
    const d=C.distance(state.points);$('stat-distance').textContent=state.points.length?d>=1000?`${(d/1000).toFixed(1)} km`:`${Math.round(d)} m`:'—';
    $('stat-points').textContent=String(state.points.length);
    $('stat-range').textContent=state.points.length?`${time(state.points[0])} — ${time(state.points[state.points.length-1])}`:'Sin registros para esta fecha';
    const latest=state.latest.get(member.id);$('stat-age').textContent=latest?C.ageLabel(latest).replace('Hace ',''):'Sin datos';
    const health=C.deviceState(state.status.get(member.id),latest);
    $('stat-accuracy').textContent=latest?`${health.short} · ±${Math.round(Number(latest.acc)||0)} m`:health.short;
    const warning=['disabled','permission','paused','stale','stale_location','clock'].includes(health.kind)&&$('date-pick').value===C.today();
    $('device-notice').hidden=!warning;$('device-notice').textContent=warning?`${health.title}. ${health.detail}`:'';
  }
  function reducedMotion(){return window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
  function openSettings(){
    const c=state.config||stored();$('cfg-owner').value=c?.owner||'';$('cfg-repo').value=c?.repo||'';$('cfg-token').value=c?.token||'';$('cfg-members').value=c?.members.map(m=>m.label).join(', ')||'';
    try{$('cfg-remember').checked=!!localStorage.getItem('family_location_v2');}catch{$('cfg-remember').checked=false;}
    $('settings-error').hidden=true;$('settings-dialog').showModal();
  }
  $('settings-form').addEventListener('submit',async e=>{
    e.preventDefault();const owner=$('cfg-owner').value.trim(),repo=$('cfg-repo').value.trim(),token=$('cfg-token').value.trim();
    const members=[...new Map($('cfg-members').value.split(',').map(label=>({id:C.slug(label),label:label.trim()})).filter(m=>m.id).map(m=>[m.id,m])).values()];
    const error=$('settings-error'),button=$('settings-save');error.hidden=true;
    if(!members.length||members.length>10){error.textContent='Agregá entre 1 y 10 teléfonos con nombres diferentes.';error.hidden=false;return;}
    if(!/^[A-Za-z0-9-]+$/.test(owner)||!/^[A-Za-z0-9_.-]+$/.test(repo)||repo==='.'||repo==='..'){error.textContent='Revisá el usuario y el nombre del repositorio.';error.hidden=false;return;}
    button.disabled=true;button.textContent='Comprobando…';
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const res=await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,{signal:controller.signal,cache:'no-store',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
      if(!res.ok)throw new Error(res.status===401?'El token no es válido o venció.':'No pudimos acceder. Revisá el repositorio privado y el permiso del token.');
      const metadata=await res.json();if(!metadata.private)throw new Error('El repositorio de ubicaciones debe ser privado.');
      const config={owner,repo,token,members};
      try{saveStorage(config,$('cfg-remember').checked);}catch{toast('El navegador no permite guardar. La conexión durará mientras esta página esté abierta.');}
      $('settings-dialog').close();setMode(config);toast('Tu espacio familiar está conectado.');
    }catch(err){error.textContent=err.name==='AbortError'?'La conexión tardó demasiado. Revisá internet y volvé a intentar.':err.message;error.hidden=false;}
    finally{clearTimeout(timeout);button.disabled=false;button.textContent='Conectar mi familia ↗';}
  });
  for(const id of ['settings-open','mobile-settings','connect-demo'])$(id).addEventListener('click',openSettings);
  $('settings-close').addEventListener('click',()=>{$('settings-dialog').close();$('cfg-token').type='password';$('toggle-token').setAttribute('aria-label','Mostrar token');});
  $('toggle-token').addEventListener('click',()=>{const show=$('cfg-token').type==='password';$('cfg-token').type=show?'text':'password';$('toggle-token').setAttribute('aria-label',show?'Ocultar token':'Mostrar token');});
  $('use-demo').addEventListener('click',()=>{$('settings-dialog').close();setMode();});
  $('forget').addEventListener('click',()=>{try{localStorage.removeItem('family_location_v2');sessionStorage.removeItem('family_location_v2');localStorage.removeItem('visor_ubicacion_cfg');}catch{}$('cfg-token').value='';$('settings-dialog').close();setMode();toast('Se olvidaron los datos de acceso en este navegador.');});
  $('refresh').addEventListener('click',()=>load(false));
  $('refresh').setAttribute('aria-label','Actualizar ubicaciones');
  $('date-pick').value=C.today();$('date-pick').max=C.today();
  $('date-pick').addEventListener('change',()=>{if(!$('date-pick').value)return;state.points=[];state.limit=8;render();load(true);});
  $('fit-map').addEventListener('click',()=>{state.fit=true;renderMap();});
  $('show-more').addEventListener('click',()=>{state.limit+=24;renderTimeline();});
  $('nav-history').addEventListener('click',()=>$('history-panel').scrollIntoView({behavior:reducedMotion()?'instant':'smooth'}));
  $('nav-map').addEventListener('click',()=>{$('main').scrollIntoView({behavior:reducedMotion()?'instant':'smooth'});state.fit=true;renderMap();});
  $('export').addEventListener('click',()=>{if(!state.points.length)return;const url=URL.createObjectURL(new Blob([C.csv(state.points)],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`${state.demo?'DEMO-':''}${state.selected}-${$('date-pick').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);});
  function rollover(){const day=C.today();$('date-pick').max=day;if(state.lastDay!==day){if($('date-pick').value===state.lastDay){$('date-pick').value=day;state.points=[];state.limit=8;render();}state.lastDay=day;}$('today-label').textContent=new Intl.DateTimeFormat('es-AR',{weekday:'long',day:'numeric',month:'long'}).format(new Date());}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){rollover();load(false);}});
  window.addEventListener('online',()=>load(false));window.addEventListener('offline',()=>notice('Sin conexión. Mostramos la última información recibida.'));
  setInterval(()=>{if(!document.hidden){rollover();load(false);}},60000);
  setInterval(()=>{if(!document.hidden){renderMembers();renderLocation();}},30000);
  initMap();rollover();setMode(stored());
})();
