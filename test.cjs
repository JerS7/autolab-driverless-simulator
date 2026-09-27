// Uji perilaku model tanpa ketergantungan browser atau layanan publik.
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
function element(){return {value:'',textContent:'',disabled:false,hidden:true,children:[],classList:{add(){},remove(){}},append(...x){this.children.push(...x)},prepend(x){this.children.unshift(x)},remove(){},get lastChild(){return{remove:()=>this.children.pop()}},scrollIntoView(){}};}
const els={},buttons=Array.from({length:3},element);const get=id=>els[id]??=element();
get('speed').value='40';get('pace').value='20';
const layer=()=>({addTo(){return this},bindTooltip(){return this},remove(){},setLatLng(){},getBounds(){return []},on(){return this}});
const ctx=vm.createContext({console,AbortController,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){},matchMedia:()=>({matches:true}),ResizeObserver:class{observe(){}},document:{getElementById:get,createElement:element,querySelectorAll:()=>buttons,querySelector:element,addEventListener(){}},L:{map:()=>({setView(){return this},distance:(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])*111000,fitBounds(){},invalidateSize(){}}),tileLayer:layer,polyline:layer,marker:layer,divIcon:x=>x},fetch:async()=>({ok:true,json:async()=>({code:'Ok',routes:[{geometry:{coordinates:[[106.82,-6.17],[106.82,-6.18],[106.825,-6.185]]}}]})})});
vm.runInContext(readFileSync(__dirname+'/app.js','utf8'),ctx);
const run=code=>vm.runInContext(code,ctx);
(async()=>{
  get('origin').value='0';get('destination').value='2';await run('calculateRoute()');assert.equal(run('mode'),'ready');assert.ok(run('total')>1000);
  run('start(); for(let i=0;i<400;i++)advance(.025)');assert.ok(run('velocity')>0);const before=run('traveled');run('start()');assert.equal(run('mode'),'paused');assert.equal(run('traveled'),before);run('start();emergency()');assert.equal(run('mode'),'emergency');assert.equal(run('velocity'),0);
  for(const type of ['red','pedestrian','obstacle']){
    run('reset();start();for(let i=0;i<400;i++)advance(.025)');assert.equal(run(`addIncident('${type}')`),true);assert.equal(run("addIncident('red')"),false);
    const at=run('incident.at');let n=0;while(!run('incident.stopped')&&n++<5000)run('advance(.025)');assert.ok(n<5000);assert.equal(run('velocity'),0);assert.ok(Math.abs(run('traveled')-at)<.001);n=0;while(run('incident!==null')&&n++<1000)run('advance(.025)');assert.ok(n<1000);run('advance(.025)');assert.ok(run('velocity')>0);
  }
  run('reset();start();for(let i=0;i<30000 && mode===\'running\';i++)advance(.025)');assert.equal(run('mode'),'finished');assert.equal(run('traveled'),run('total'));assert.equal(run('velocity'),0);
  run('reset()');assert.equal(run('traveled'),0);assert.equal(run('elapsed'),0);
  get('destination').value='0';await run('calculateRoute()');assert.match(get('route-status').textContent,/harus berbeda/);
  get('destination').value='2';ctx.fetch=async()=>{throw Error('network')};await run('calculateRoute()');assert.equal(run('mode'),'empty');assert.equal(run('total'),0);assert.equal(get('start').disabled,true);
  console.log('PASS: route, pause/resume, emergency, all 3 incident braking/wait/resume scenarios, arrival, reset, equal endpoints, API failure.');
})().catch(error=>{console.error(error);process.exitCode=1});
