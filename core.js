(function(root){
  'use strict';
  const slug=s=>String(s||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const today=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function validPoint(p){return p&&typeof p.lat==='number'&&Number.isFinite(p.lat)&&Math.abs(p.lat)<=90&&typeof p.lon==='number'&&Number.isFinite(p.lon)&&Math.abs(p.lon)<=180&&typeof p.t==='string'&&Number.isFinite(Date.parse(p.t));}
  function cleanPoints(data){
    if(!Array.isArray(data))throw new Error('El historial no tiene el formato esperado. No modificamos tus datos.');
    const unique=new Map();for(const p of data){if(validPoint(p))unique.set(p.id||`${p.t}/${p.lat}/${p.lon}`,p);}
    return [...unique.values()].sort((a,b)=>Date.parse(a.t)-Date.parse(b.t));
  }
  function freshness(p,now=Date.now()){
    if(!validPoint(p))return {kind:'unknown',label:'Sin ubicación',short:'Sin registros',age:null};
    const age=now-Date.parse(p.t);
    if(age < -120000)return {kind:'stale',label:'Revisar hora del teléfono',short:'Hora incorrecta',age};
    const threshold=Math.max(10,Math.min(Number(p.interval)||5,15)*2)*60000;
    if(age>threshold)return {kind:'stale',label:'Ubicación desactualizada',short:'Sin señal reciente',age};
    return {kind:'fresh',label:'Ubicación reciente',short:'Señal reciente',age};
  }
  function ageLabel(p,now=Date.now()){
    const age=freshness(p,now).age;if(age===null)return 'Sin registros';if(age < -120000)return 'Hora incorrecta';
    const m=Math.max(0,Math.floor(age/60000));if(m<1)return 'Hace un momento';if(m<60)return `Hace ${m} min`;if(m<1440)return `Hace ${Math.floor(m/60)} h`;return `Hace ${Math.floor(m/1440)} días`;
  }
  function meters(a,b){const rad=n=>n*Math.PI/180,dlat=rad(b.lat-a.lat),dlon=rad(b.lon-a.lon),h=Math.sin(dlat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dlon/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
  function segments(points){const groups=[];for(const p of points){const group=groups[groups.length-1],prev=group?.[group.length-1];if(!prev||Date.parse(p.t)-Date.parse(prev.t)>30*60000||meters(prev,p)/Math.max(1,(Date.parse(p.t)-Date.parse(prev.t))/1000)>100)groups.push([p]);else group.push(p);}return groups;}
  function distance(points){let total=0;for(const group of segments(points))for(let i=1;i<group.length;i++){const a=group[i-1],b=group[i],d=meters(a,b),aa=Number(a.acc)||100,ab=Number(b.acc)||100;if(aa>0&&ab>0&&aa<=100&&ab<=100&&d>Math.max(aa,ab))total+=d;}return total;}
  function csv(points){const safe=v=>typeof v==='number'&&Number.isFinite(v)?String(v):'"'+String(v??'').replace(/"/g,'""').replace(/^[=+@-]/,"'$&")+'"';return '\uFEFF'+['fecha_hora,latitud,longitud,precision_m,bateria_pct',...points.map(p=>[p.t,p.lat,p.lon,p.acc??'',p.battery??''].map(safe).join(','))].join('\r\n');}
  function memberDirectories(data,aliases=[]){
    if(!Array.isArray(data))return [];
    const names=new Map(aliases.map(m=>[m.id,m.label]));
    return [...new Set(data.filter(d=>d&&d.type==='dir'&&typeof d.name==='string'&&d.name&&slug(d.name)===d.name).map(d=>d.name))]
      .sort().slice(0,10).map(id=>({id,label:names.get(id)||id.split('-').map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join(' ')}));
  }
  function deviceState(status,point,now=Date.now()){
    const fix=freshness(point,now);
    const valid=status&&!Array.isArray(status)&&Number.isFinite(Date.parse(status.t));
    if(valid){
      const age=now-Date.parse(status.t),limit=Math.max(10,Math.min(Number(status.interval)||5,15)*2+2)*60000;
      if(age < -120000)return {kind:'clock',short:'Revisar hora',title:'Revisá la hora del teléfono',detail:'El último reporte tiene una hora adelantada. No podemos confirmar su antigüedad.'};
      if(age>limit)return {kind:'stale',short:'Sin señal reciente',title:'No recibimos señal reciente',detail:'La app dejó de informar. Puede estar sin conexión, detenida, con el teléfono apagado o sin batería. No podemos determinar la causa.'};
      if(status.tracking_enabled===false)return {kind:'paused',short:'Compartir pausado',title:'El teléfono reportó el seguimiento pausado',detail:'Las ubicaciones anteriores siguen visibles con su hora original.'};
      if(status.permission_granted===false)return {kind:'permission',short:'Sin permiso de ubicación',title:'El teléfono reportó que falta el permiso de ubicación',detail:'La app no puede obtener posiciones nuevas hasta que se habilite el permiso.'};
      if(status.location_enabled===false)return {kind:'disabled',short:'Ubicación desactivada',title:'El teléfono reportó la ubicación desactivada',detail:'Ese fue el estado de su último reporte. La ubicación anterior conserva su hora; no representa una posición actual.'};
      if(fix.kind==='unknown')return {kind:'waiting',short:'Conectado · esperando ubicación',title:'Teléfono conectado con tu familia',detail:'Esperando una posición reciente. Puede necesitar unos momentos de señal GPS.'};
      if(fix.kind==='stale')return {kind:'stale_location',short:'Sin ubicación reciente',title:'El teléfono está conectado, pero no tiene una ubicación reciente',detail:'Puede estar sin señal GPS. Mostramos la última posición conocida con su hora original.'};
    }
    return {kind:fix.kind,short:fix.short,title:fix.label,detail:fix.kind==='stale'?'No hay una posición reciente. No podemos determinar la causa.':''};
  }
  const api={slug,today,validPoint,cleanPoints,freshness,ageLabel,meters,segments,distance,csv,memberDirectories,deviceState};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FamilyCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
