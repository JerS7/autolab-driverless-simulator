'use strict';
const $ = id => document.getElementById(id);
const places = [
  ['Monas', -6.1754, 106.8272], ['Stasiun Gambir', -6.1767, 106.8306],
  ['Bundaran HI', -6.1951, 106.8229], ['Sarinah', -6.1874, 106.8232],
  ['Taman Ismail Marzuki', -6.1901, 106.8397], ['Stasiun Cikini', -6.1985, 106.8415]
];
const lessons = [
  ['Rencanakan perjalanan', 'Pilih keberangkatan dan tujuan yang berbeda, lalu klik Hitung rute. Garis hijau menunjukkan jalur jalan yang direncanakan kendaraan.', 'Coba: Monas → Bundaran HI.'],
  ['Dari peta menjadi gerakan', 'Klik Mulai. Posisi kendaraan bergerak sepanjang rute; kontrol sederhana mempercepat kendaraan menuju batas kecepatan. Waktu 20× mempercepat demo, bukan batas kendaraan.', 'Amati kecepatan dan jarak tempuh.'],
  ['Persepsi: mengenali lingkungan', 'Saat berjalan, tekan Pejalan kaki. Sensor virtual mendeteksi objek di depan. Ini adalah masukan skenario buatan, bukan kamera atau LiDAR sungguhan.', 'Coba sisipkan satu kejadian.'],
  ['Keputusan dan kontrol', 'Kendaraan memperlambat lalu berhenti sebelum objek. Lampu merah, pejalan kaki, dan hambatan memiliki waktu tunggu berbeda. Setelah aman, kendaraan melanjutkan perjalanan.', 'Bandingkan respons ketiga skenario.'],
  ['Evaluasi perjalanan', 'Amati log dan total waktu saat tiba. Berhenti darurat menghentikan simulasi seketika dan memerlukan Lanjutkan. Reset mengembalikan kendaraan ke awal rute.', 'Ulangi dengan batas kecepatan berbeda.']
];
let map, line, vehicle, endpoints = [], eventMarker;
let points = [], cumulative = [], total = 0, traveled = 0, velocity = 0, elapsed = 0;
let mode = 'empty', incident = null, frame = 0, last = 0, lesson = 0, requestId = 0, controller;
const incidentTypes = {red: ['Lampu merah', 8, 'Sinyal berubah hijau. Jalur kembali diizinkan.'], pedestrian: ['Pejalan kaki', 6, 'Pejalan kaki selesai menyeberang. Jalur aman.'], obstacle: ['Hambatan jalan', 12, 'Hambatan disingkirkan dalam skenario. Jalur aman.']};
const fmt = value => value.toLocaleString('id-ID', {minimumFractionDigits:2, maximumFractionDigits:2});
const clock = value => `${String(Math.floor(value / 60)).padStart(2,'0')}:${String(Math.floor(value % 60)).padStart(2,'0')}`;
function log(text) {const li=document.createElement('li'), t=document.createElement('time'), span=document.createElement('span');t.textContent=clock(elapsed);span.textContent=text;li.append(t,span);$('logs').prepend(li);while($('logs').children.length>40)$('logs').lastChild.remove();}
function decision(title, text){$('decision').textContent=title;$('reason').textContent=text;}
function controls(){
  $('start').disabled=!['ready','running','paused','emergency','finished'].includes(mode);
  $('start').textContent=mode==='running'?'Ⅱ Jeda':mode==='paused'||mode==='emergency'?'▶ Lanjutkan':mode==='finished'?'↺ Ulangi':'▶ Mulai';
  $('reset').disabled=!total||mode==='loading';
  $('emergency').disabled=mode!=='running';
  document.querySelectorAll('[data-event]').forEach(b=>b.disabled=mode!=='running'||!!incident||total-traveled<100);
  $('route').disabled=mode==='loading';
  $('origin').disabled=$('destination').disabled=mode==='loading';
}
function render(){
  $('velocity').textContent=Math.round(velocity*3.6);$('distance').textContent=`${fmt(traveled/1000)} km`;
  $('remaining').textContent=total?`${fmt(Math.max(0,total-traveled)/1000)} km`:'—';$('elapsed').textContent=clock(elapsed);
  $('progress').value=total?traveled/total*100:0;
  const statuses={empty:'Menunggu rute',loading:'Menghitung rute',ready:'Siap berangkat',running:incident?(velocity>.05?'Mengerem':'Menunggu aman'):'Mengemudi otomatis',paused:'Simulasi dijeda',emergency:'Berhenti darurat',finished:'Tiba di tujuan'};
  $('state').textContent=statuses[mode];if(vehicle&&points.length)vehicle.setLatLng(position(traveled));controls();
}
function position(distance){let lo=0,hi=cumulative.length-1;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(cumulative[mid]<distance)lo=mid+1;else hi=mid;}const i=Math.max(1,lo),a=points[i-1],b=points[i],length=cumulative[i]-cumulative[i-1],t=length?Math.min(1,Math.max(0,(distance-cumulative[i-1])/length)):0;return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];}
function stopFrame(){cancelAnimationFrame(frame);last=0;}
function clearIncident(){incident=null;if(eventMarker){eventMarker.remove();eventMarker=null;}}
function reset(){stopFrame();clearIncident();traveled=velocity=elapsed=0;mode=total?'ready':'empty';decision('Rute siap','Tekan Mulai untuk menjalankan kendaraan. Sisipkan kejadian untuk mempelajari respons sistem.');render();}
function invalidate(){requestId++;controller?.abort();reset();total=0;points=[];cumulative=[];if(line)line.remove();if(vehicle)vehicle.remove();line=vehicle=null;endpoints.forEach(m=>m.remove());endpoints=[];mode='empty';$('route-status').textContent='Pilihan berubah. Hitung rute baru untuk melanjutkan.';decision('Siap merencanakan','Hitung rute untuk titik keberangkatan dan tujuan yang dipilih.');render();}
async function calculateRoute(){
  if(!map)return;
  if($('origin').value===$('destination').value){$('route-status').textContent='Keberangkatan dan tujuan harus berbeda.';return;}
  invalidate();const id=++requestId;controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);mode='loading';render();$('route-status').textContent='Mencari jalur jalan melalui OSRM…';
  const a=places[+$('origin').value],b=places[+$('destination').value];
  try{
    const response=await fetch(`https://router.project-osrm.org/route/v1/driving/${a[2]},${a[1]};${b[2]},${b[1]}?overview=full&geometries=geojson`,{signal:controller.signal});
    if(!response.ok)throw Error('Layanan rute tidak tersedia.');const data=await response.json();if(id!==requestId)return;
    const geometry=data.routes?.[0]?.geometry?.coordinates;
    if(data.code!=='Ok'||!Array.isArray(geometry)||geometry.length<2||geometry.some(p=>!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1])))throw Error('Rute jalan tidak ditemukan.');
    points=geometry.map(p=>[p[1],p[0]]);cumulative=[0];for(let i=1;i<points.length;i++)cumulative.push(cumulative[i-1]+map.distance(points[i-1],points[i]));total=cumulative.at(-1);if(total<1)throw Error('Rute terlalu pendek.');
    line=L.polyline(points,{color:'#368266',weight:6,opacity:.85}).addTo(map);
    [points[0],points.at(-1)].forEach((p,i)=>endpoints.push(L.marker(p,{icon:L.divIcon({className:'point',html:i?'B':'A',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map).bindTooltip(i?b[0]:a[0])));
    vehicle=L.marker(points[0],{icon:L.divIcon({className:'vehicle',html:'↗',iconSize:[30,30],iconAnchor:[15,15]}),zIndexOffset:1000}).addTo(map).bindTooltip('Kendaraan otonom');
    reset();map.fitBounds(line.getBounds(),{padding:[55,75]});$('route-status').textContent=`${fmt(total/1000)} km · rute jalan tersedia`;log(`Rute ${a[0]} → ${b[0]} siap (${fmt(total/1000)} km).`);
  }catch(error){if(id!==requestId)return;total=0;points=[];mode='empty';$('route-status').textContent='Rute gagal dimuat. Periksa internet, lalu klik Hitung rute untuk mencoba lagi.';decision('Rute belum tersedia','Layanan peta membutuhkan koneksi internet. Kendaraan hanya berjalan setelah rute valid tersedia.');render();}
  finally{clearTimeout(timer);if(id===requestId){controls();}}
}
function start(){if(mode==='running'){stopFrame();mode='paused';decision('Simulasi dijeda','Posisi dan waktu dipertahankan. Tekan Lanjutkan untuk meneruskan perjalanan.');log('Simulasi dijeda.');render();return;}if(!total||mode==='loading')return;if(mode==='finished')reset();mode='running';last=0;decision(incident?'Merespons kejadian':'Jalur dapat dilalui',incident?'Skenario dilanjutkan dari kondisi sebelumnya.':'Kontrol kendaraan menyesuaikan kecepatan menuju batas yang dipilih.');log('Kendaraan berjalan otomatis.');render();frame=requestAnimationFrame(tick);}
function addIncident(type){if(!incidentTypes[type]||mode!=='running'||incident||total-traveled<100)return false;const [name,wait]=incidentTypes[type];const stopping=velocity*velocity/(2*3);incident={type,name,wait,at:Math.min(total-20,traveled+Math.max(45,stopping+25)),stopped:false};eventMarker=L.marker(position(incident.at+8),{icon:L.divIcon({className:'event-pin',html:'!',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map).bindTooltip(name,{permanent:true,direction:'top'});decision(`${name} terdeteksi`,'Persepsi → perencanaan → kontrol: kurangi kecepatan dan berhenti sebelum titik kejadian.');log(`${name} terdeteksi. Kendaraan mengerem dengan perlambatan 3 m/s².`);render();return true;}
function advance(dt){
  elapsed+=dt;let target=Number($('speed').value)/3.6;const remaining=total-traveled;
  target=Math.min(target,Math.sqrt(2*3*Math.max(0,remaining)));
  if(incident)target=Math.min(target,Math.sqrt(2*3*Math.max(0,incident.at-traveled)));
  const old=velocity;velocity=target>velocity?Math.min(target,velocity+2*dt):Math.max(target,velocity-3*dt);
  traveled=Math.min(total,traveled+(old+velocity)/2*dt);
  if(incident&&traveled>=incident.at-.15){traveled=incident.at;velocity=0;if(!incident.stopped){incident.stopped=true;log(`Berhenti aman: ${incident.name}.`);decision('Menunggu kondisi aman',`${incident.name}: menunggu ${incident.wait} detik waktu simulasi. Kendaraan tidak melanjutkan sebelum skenario dinyatakan aman.`);}incident.wait-=dt;if(incident.wait<=0){const text=incidentTypes[incident.type][2];log(text);clearIncident();decision('Jalur kembali aman',text+' Kendaraan kembali mempercepat.');}}
  if(total-traveled<.15&&!incident){traveled=total;velocity=0;mode='finished';decision('Perjalanan selesai',`Tiba di tujuan setelah ${clock(elapsed)} waktu simulasi. Ulangi perjalanan untuk membandingkan skenario.`);log('Tiba di tujuan. Kendaraan berhenti.');}
}
function tick(now){if(mode!=='running')return;const delta=last?Math.min((now-last)/1000,.1):0;last=now;let dt=delta*Number($('pace').value);while(dt>0&&mode==='running'){const slice=Math.min(dt,.025);advance(slice);dt-=slice;}render();if(mode==='running')frame=requestAnimationFrame(tick);}
function emergency(){if(mode!=='running')return;stopFrame();velocity=0;mode='emergency';decision('Penghentian darurat','Simulasi dihentikan seketika oleh pengguna. Tekan Lanjutkan untuk mengaktifkan kembali kendaraan.');log('Pengguna mengaktifkan berhenti darurat.');render();}
function showLesson(){const [title,text,hint]=lessons[lesson];$('lesson-title').textContent=title;$('lesson-text').textContent=text;$('lesson-hint').textContent=hint;$('step-number').textContent=String(lesson+1).padStart(2,'0');$('step-count').textContent=`0${lesson+1} / 05`;$('prev').disabled=lesson===0;$('next').textContent=lesson===4?'Ulang tutorial ↺':'Berikutnya →';}
places.forEach((place,i)=>{['origin','destination'].forEach(id=>{const o=document.createElement('option');o.value=i;o.textContent=place[0];$(id).append(o);});});$('destination').value='2';
try{map=L.map('map',{zoomControl:true}).setView([-6.187,106.831],14);const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'}).addTo(map);let failures=0;tiles.on('tileerror',()=>{if(++failures>=3){$('map-error').hidden=false;$('map-error').textContent='Sebagian peta belum termuat. Periksa koneksi internet; rute tetap dapat dicoba.';}});tiles.on('tileload',()=>{$('map-error').hidden=true;failures=0;});new ResizeObserver(()=>map.invalidateSize()).observe($('map'));}catch(error){$('map-error').hidden=false;$('map-error').textContent='Library peta gagal dimuat. Pastikan folder vendor tersedia dan muat ulang halaman.';$('route').disabled=true;}
$('route').onclick=calculateRoute;['origin','destination'].forEach(id=>$(id).onchange=invalidate);$('start').onclick=start;$('reset').onclick=()=>{reset();log('Perjalanan direset ke titik awal.');};$('emergency').onclick=emergency;$('fit').onclick=()=>{if(line)map.fitBounds(line.getBounds(),{padding:[55,75]});else map?.setView([-6.187,106.831],14);};$('speed').oninput=()=>{$('speed-value').textContent=`${$('speed').value} km/jam`;};document.querySelectorAll('[data-event]').forEach(b=>b.onclick=()=>addIncident(b.dataset.event));$('prev').onclick=()=>{lesson=Math.max(0,lesson-1);showLesson();};$('next').onclick=()=>{lesson=(lesson+1)%lessons.length;showLesson();};$('help').onclick=()=>{const el=document.querySelector('.tutorial');el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});el.classList.add('active');setTimeout(()=>el.classList.remove('active'),2000);};document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='running')start();});showLesson();
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'read_driverless_state',description:'Membaca status perjalanan simulator yang terlihat di halaman.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>({status:mode,distanceMeters:traveled,totalMeters:total,speedKmh:velocity*3.6,elapsedSeconds:elapsed,event:incident?.name??null})})).catch(()=>{});}catch{}}
