(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const content = window.TERRA_CONTENT;
  if (!content || !Array.isArray(content.countries)) {
    $('archive-content').innerHTML = '<h2>档案暂未载入</h2><p>请刷新页面重试。</p>';
    return;
  }
  const coords=Object.fromEntries(Object.entries(window.TERRA_REGIONS).map(([id,r])=>[id,r.anchor]));
  const expansion=window.TERRA_ARCHIVE || {countries:[],concepts:[]};
  const extendedById=new Map(expansion.countries.map(c=>[c.id,c]));
  const countries = content.countries.map((c,i) => ({...c,coords:coords[c.id],index:i+1,dossier:extendedById.get(c.id)}));
  const concepts=[...content.concepts,...expansion.concepts];
  const characters=(window.TERRA_CHARACTERS?.characters||[]);
  const operatorCoverage=window.TERRA_CHARACTERS?.meta.operatorCoverage;
  const characterById=new Map(characters.map(p=>[p.id,p]));
  const librarySearch=window.TERRA_SEARCH.create({countries,concepts,characters});
  const normalize=window.TERRA_SEARCH.normalize;
  const coverage={places:countries.reduce((n,c)=>n+(c.dossier?.places.length||0),0),organizations:countries.reduce((n,c)=>n+(c.dossier?.organizations.length||0),0)};
  const byId = new Map(countries.map(c => [c.id,c]));
  const tours = {
    industry:{title:'文明的引擎',subtitle:'工业、矿业与技术革新',ids:['columbia','victoria','rim-billiton'],icon:'<path d="M4 20V9l6 4V6l6 4V3h4v17ZM8 16v1m5-1v1m4-1v1"/>'},
    culture:{title:'信仰与回响',subtitle:'音乐、律法与地方传统',ids:['leithanien','laterano','yan'],icon:'<path d="M12 3 3 8l9 5 9-5ZM5 11v7l7 4 7-4v-7M12 13v9"/>'},
    frontier:{title:'走向大地边缘',subtitle:'北境、雪山与沙海',ids:['sami','kjerag','sargon'],icon:'<path d="m2 20 8-14 5 8 3-5 5 11ZM8 10l2 3 2-3"/>'}
  };
  const labels = {all:'全部地区',industry:'工业与科技',culture:'文化与信仰',frontier:'荒野与边境'};
  const state = {selected:null,filter:'all',style:'terminal',showLabels:true,view:'overview',tour:null,tourIndex:0,countryPane:'overview',archiveVisible:false,tilt:true,character:null,peopleQuery:'',peopleRegion:'all',peopleProfession:'all',peopleRarity:'all',peopleKind:'all',peopleLimit:60};
  const operatorDetailCache=new Map();
  let operatorRequest=0;
  const storageKey = 'terra-geographic-saved-v1';
  const visitedKey = 'terra-geographic-visited-v1';
  function readSet(key) {
    try {
      const ids = JSON.parse(localStorage.getItem(key) || '[]');
      return new Set(Array.isArray(ids) ? ids.filter(id => byId.has(id)) : []);
    } catch { return new Set(); }
  }
  const saved = readSet(storageKey), visited = readSet(visitedKey);
  const viewport = $('map-viewport'), stage = $('map-stage'), markers = $('map-markers'), archive = $('archive-content');
  const panel = document.querySelector('.map-panel'), workspace = document.querySelector('.workspace');
  const camera = {x:0,y:0,scale:1,fit:1};
  const pointers = new Map();
  let animation=0,toastTimer=0,searchHits=[],searchIndex=-1,searchScope='all',searchLimit=30,didDrag=false,initialized=false;
  let pointerOrigin=null,pinchOrigin=null,archiveReturn=null;
  let keyboardMode=false,motionOff=false,cameraTarget=null;
  const sheet={height:0,preview:0};
  const systemMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  try{motionOff=localStorage.getItem('terra-motion-v1')==='off';}catch{}
  const esc = s => String(s).replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pad = n => String(n).padStart(2,'0');
  const mobile = () => window.innerWidth<=760;
  const reduceMotion = () => systemMotion.matches||motionOff;
  const canAnimate = () => !reduceMotion()&&!keyboardMode&&!document.documentElement.hasAttribute('data-palette-compare');
  function setColorTheme(theme,{persist=true}={}){
    const day=theme==='day',button=$('theme-toggle');
    document.documentElement.dataset.theme=day?'day':'night';
    if(!document.documentElement.dataset.palettePreview)document.documentElement.dataset.palette=day?'glacier':'graphite';
    button.setAttribute('aria-pressed',String(day));
    button.title=day?'切换为夜间配色':'切换为白天配色';
    button.querySelector('span').textContent=day?'白天':'夜间';
    button.querySelector('svg').innerHTML=day?'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>':'<path d="M20.3 14.2A8.5 8.5 0 0 1 9.8 3.7 8.5 8.5 0 1 0 20.3 14.2Z"/>';
    document.querySelector('[data-style="terminal"]').textContent=day?'测绘':'全息';
    document.querySelector('meta[name="theme-color"]').content=window.TERRA_PALETTES?.find(p=>p.id===document.documentElement.dataset.palette)?.colors.canvas||(day?'#dfe7f0':'#171b21');
    if(persist&&!document.documentElement.dataset.palettePreview)try{localStorage.setItem('terra-color-theme-v2',day?'day':'night');}catch{}
  }
  $('theme-toggle').addEventListener('click',()=>setColorTheme(document.documentElement.dataset.theme==='day'?'night':'day'));
  function reveal(element,distance=6,duration=180){
    if(!element||!canAnimate())return;
    element.getAnimations().forEach(a=>a.cancel());
    element.animate([{opacity:.35,transform:'translate3d(0,'+distance+'px,0)'},{opacity:1,transform:'translate3d(0,0,0)'}],{duration,easing:'cubic-bezier(.22,1,.36,1)'}).finished.catch(()=>{});
  }
  function updateMotion(){
    document.documentElement.classList.toggle('motion-reduced',reduceMotion());
    const on=!reduceMotion(),button=$('motion-toggle');
    button.setAttribute('aria-pressed',String(on));
    button.disabled=systemMotion.matches;
    button.querySelector('span').textContent=on?'动效开':'动效关';
    const label=systemMotion.matches?'已跟随系统减少动态效果':on?'关闭界面动效':'开启界面动效';
    button.setAttribute('aria-label',label);button.title=label;
    if(!on){
      document.getAnimations().forEach(a=>a.cancel());
      if(cameraTarget){cancelAnimationFrame(animation);Object.assign(camera,cameraTarget);cameraTarget=null;applyCamera();layoutLabels();}
      positionMarkers();layoutLabels();
    }
  }
  document.addEventListener('pointerdown',()=>{keyboardMode=false;document.documentElement.classList.remove('keyboard-input');},{capture:true});
  document.addEventListener('keydown',e=>{if(e.metaKey||e.ctrlKey||e.altKey)return;keyboardMode=true;document.documentElement.classList.add('keyboard-input');},{capture:true});
  $('motion-toggle').addEventListener('click',()=>{
    motionOff=!motionOff;
    try{localStorage.setItem('terra-motion-v1',motionOff?'off':'on');}catch{}
    updateMotion();
    toast(reduceMotion()?'界面动效已关闭':'界面动效已开启');
  });
  systemMotion.addEventListener('change',updateMotion);
  function syncSheetGeometry(){
    if(!mobile())return;
    sheet.height=Math.max(270,viewport.clientHeight-78);
    sheet.preview=Math.min(sheet.height,Math.max(270,viewport.clientHeight*.56));
    const element=$('archive');
    element.style.setProperty('--sheet-height',sheet.height+'px');
    element.style.setProperty('--sheet-preview',sheet.preview+'px');
    element.style.setProperty('--sheet-offset',sheet.height-sheet.preview+'px');
    const chrome=$('sheet-expand').offsetHeight+element.querySelector('.archive-topline').offsetHeight+element.querySelector('.archive-tabs').offsetHeight+2;
    element.style.setProperty('--sheet-chrome',chrome+'px');
  }
  const isArchiveOpen=()=>state.archiveVisible;
  function toast(message) {
    $('toast').textContent=message;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer=setTimeout(() => $('toast').classList.remove('show'),2600);
  }
  function persist(key,set) {
    try { localStorage.setItem(key,JSON.stringify([...set])); return true; }
    catch { return false; }
  }
  function syncArchive(){
    const sheet=$('archive'),closed=!state.archiveVisible;
    sheet.inert=closed;sheet.setAttribute('aria-hidden',String(closed));
    sheet.classList.toggle('mobile-open',!closed);
    workspace.classList.toggle('panel-open',!closed);
    workspace.classList.toggle('archive-open',mobile()&&!closed);
    $('mobile-archive-button').setAttribute('aria-expanded',String(!closed));
    syncSheetGeometry();
    syncOperatorStage();
  }
  function showArchive(){
    if(!state.archiveVisible)archiveReturn=document.activeElement;
    state.archiveVisible=true;syncArchive();
  }
  function closeArchive({restore=true}={}){
    const opened=state.archiveVisible;state.archiveVisible=false;
    $('archive').classList.remove('sheet-expanded');
    $('sheet-expand').setAttribute('aria-expanded','false');$('sheet-expand').setAttribute('aria-label','展开档案');
    $('sheet-expand').querySelector('b').textContent='展开阅读';syncArchive();
    if(opened&&restore){const target=archiveReturn?.isConnected?archiveReturn:$('mobile-archive-button');target.focus({preventScroll:true});}
    if(opened){if(state.selected)focusOn(byId.get(state.selected));else resetMap();}
  }
  function setArchive(html,index='T / 000') {
    const restoreFocus=archive.contains(document.activeElement);
    const viewKey=state.view+'|'+(state.character||state.selected||'');
    const changed=archive.dataset.viewKey!==viewKey;
    archive.dataset.viewKey=viewKey;
    archive.innerHTML='<div class="content-in">'+html+'</div>';
    if(changed)reveal(archive.firstElementChild);
    if(restoreFocus){const heading=archive.querySelector('h2');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
    archive.scrollTop=0;
    $('archive-index').textContent=index;
    document.querySelector('.archive-topline>span:first-child').textContent=state.view==='character'?'人物档案':'地理档案';
    document.querySelectorAll('[data-view]').forEach(b => {
      const active=b.dataset.view===(state.view==='country'?'list':state.view==='character'?'people':state.view);
      b.classList.toggle('active',active);
      if(active) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current');
    });
    $('dock-index').classList.toggle('active',state.view==='list');
    $('dock-saved').classList.toggle('active',state.view==='saved');
    $('dock-characters').classList.toggle('active',['people','character'].includes(state.view));
    syncOperatorStage();
  }
  function syncCounts() {
    $('characters-count').textContent=characters.length;
    $('archive-characters-count').textContent=characters.length;
    $('saved-count').textContent=saved.size;
    $('archive-saved-count').textContent=saved.size;
    $('visit-status').textContent='已探索 '+visited.size+' / '+countries.length;
  }
  function readHash() { try{return decodeURIComponent(location.hash.slice(1));}catch{return '';} }
  function updateHash(id) {
    try { history.replaceState(null,'',location.pathname+location.search+(id?'#'+id.split('/').map(encodeURIComponent).join('/'):'')); } catch {}
  }
  function overview({reset=false}={}) {
    state.view='overview';state.selected=null;state.character=null;state.tour=null;
    updateHash('');setFilter('all',false);
    const cards=Object.entries(tours).map(([id,t]) =>
      '<button class="tour-card" data-tour="'+id+'"><span class="tour-symbol"><svg viewBox="0 0 24 24" aria-hidden="true">'+t.icon+'</svg></span><span><strong>'+esc(t.title)+'</strong><small>'+esc(t.subtitle)+' · '+t.ids.length+' 站</small></span><span class="arrow">↗</span></button>'
    ).join('');
    setArchive('<div class="overview-title"><span class="eyebrow">一份关于泰拉的旅行笔记</span><h2>大地巡旅<span>A JOURNEY THROUGH TERRA</span></h2><p>在天灾与迁徙之间，文明留下各自的坐标。点选一处地名，或跟随一条线索，认识这片大地。</p><div class="archive-coverage"><span>'+coverage.places+' 个地点</span><span>'+coverage.organizations+' 组地方力量</span><span>'+concepts.length+' 项世界设定</span></div></div>'+
      '<button class="people-entry" data-action="people"><span><strong>从人物认识泰拉</strong><small>人物履历、组织联系与地区背景</small></span><b>'+characters.length+' 人</b></button>'+
      '<div class="exploration-progress"><div class="progress-caption"><strong>'+visited.size+' <small>/ '+countries.length+'</small></strong><span>已打开的地区档案</span></div><div class="progress-track" role="progressbar" aria-label="地区探索进度" aria-valuemin="0" aria-valuemax="'+countries.length+'" aria-valuenow="'+visited.size+'"><span style="width:'+visited.size/countries.length*100+'%"></span></div></div>'+
      '<div class="section-label">从一条线索开始<span>每条导览 3 站</span></div>'+cards+
      '<button class="all-regions-button" data-action="list"><span>浏览全部地区</span><small>18 处档案 ↗</small></button>'+
      '<button class="saved-button" data-action="saved"><span>◇ 我的探索标记</span><b>'+pad(saved.size)+'</b></button>'+
      '<button class="archive-about-button" data-action="about">资料来源与地图范围</button>');
    updateMarkers();syncCounts();
    if(reset) resetMap();
  }
  function renderList(savedOnly=false,{open=true}={}) {
    state.view=savedOnly?'saved':'list';state.tour=null;state.selected=null;state.character=null;updateHash('');
    if(savedOnly)setFilter('all',false);
    const items=countries.filter(c => savedOnly?saved.has(c.id):(state.filter==='all'||c.group===state.filter));
    const rows=items.map(c =>
      '<button class="region-row" data-country="'+c.id+'"><small>'+pad(c.index)+'</small><span><strong>'+esc(c.name)+'</strong><small>'+esc(c.en)+'</small></span><span class="region-arrow" aria-label="'+(saved.has(c.id)?'已标记':visited.has(c.id)?'已阅读':'查看档案')+'">'+(saved.has(c.id)?'◆':visited.has(c.id)?'✓':'↗')+'</span></button>'
    ).join('');
    setArchive('<h2 class="region-list-heading">'+(savedOnly?'我的标记':'地区索引')+'</h2>'+
      '<p class="region-list-note">'+(savedOnly?'留下想重访的地方。标记保存在当前浏览器。':'先选一处感兴趣的地方，地图会带你前往。')+'</p>'+
      '<div class="list-count"><span>'+(savedOnly?'已标记':esc(labels[state.filter]))+' · '+items.length+' 处</span>'+(!savedOnly&&state.filter!=='all'?'<button data-action="clear-filter">显示全部</button>':'')+'</div>'+
      (rows||'<p class="empty-state">还没有探索标记。<br>打开地区档案，点击「标记此地」，就能在这里找到它。</p><button class="empty-action" data-action="random">随机认识一个地区</button>'),
      (savedOnly?'S / ':'I / ')+pad(items.length));
    updateMarkers();
    if(open) showArchive();
    resetMap();
  }
  function personAvatar(p,className=''){
    return p.portrait?'<img class="person-avatar '+className+'" src="'+esc(p.portrait)+'" alt="" width="96" height="96" loading="lazy">':'<span class="person-avatar person-avatar-text '+className+'" aria-hidden="true">'+esc(p.name.slice(0,1))+'</span>';
  }
  function personRow(p,{countryId=''}={}){
    return '<button class="person-row" data-character="'+esc(p.id)+'"'+(countryId?' data-character-origin="'+esc(countryId)+'"':'')+'>'+personAvatar(p)+'<span class="person-row-copy"><strong>'+esc(p.name)+'</strong><small>'+esc(p.en||p.kind)+' · '+esc(p.role)+(p.forms?.length>1?' · '+p.forms.length+' 个形态':'')+'</small><span>'+esc(p.organizations.join(' · '))+'</span></span><span class="person-row-arrow" aria-hidden="true">↗</span></button>';
  }
  function regionPeople(id){return characters.filter(p=>p.regionIds.includes(id));}
  function peopleListHTML(query,region){
    const hits=librarySearch.query(query,{scope:'person'}).map(e=>characterById.get(e.id)).filter(p=>
      (region==='all'||(region==='unmapped'?!p.regionIds.length:p.regionIds.includes(region)))&&
      (state.peopleKind==='all'||(state.peopleKind==='operator'?p.operator:!p.operator))&&
      ((state.peopleProfession==='all'&&state.peopleRarity==='all')||p.forms?.some(f=>(state.peopleProfession==='all'||f.profession===state.peopleProfession)&&(state.peopleRarity==='all'||f.rarity===Number(state.peopleRarity)))));
    const shown=hits.slice(0,state.peopleLimit);
    return '<p class="people-count" role="status">'+hits.length+' 位人物'+(query?' · “'+esc(query)+'”':'')+'</p><div class="person-list">'+(shown.map(p=>personRow(p)).join('')||'<p class="empty-state">没有匹配的人物，试试姓名、组织、职业或技能名称。</p>')+'</div>'+(shown.length<hits.length?'<button class="people-more" data-people-more>再显示 60 位 · 已显示 '+shown.length+' / '+hits.length+'</button>':'');
  }
  function updatePeopleList({reset=true}={}){
    if(reset)state.peopleLimit=60;
    const results=$('people-results');if(results)results.innerHTML=peopleListHTML(state.peopleQuery,state.peopleRegion);
  }
  function renderPeople({query='',region='all'}={}){
    state.view='people';state.selected=null;state.character=null;state.tour=null;state.peopleQuery=query;state.peopleRegion=region;state.peopleProfession='all';state.peopleRarity='all';state.peopleKind='all';state.peopleLimit=60;updateHash('people');
    const coverage=operatorCoverage?operatorCoverage.operatorCount+' 位干员 · '+operatorCoverage.operatorFormCount+' 个形态 · 另 '+operatorCoverage.nonOperatorCount+' 位非干员':'人物基础档案';
    setArchive('<div class="people-intro"><span class="eyebrow">从人物走进泰拉</span><h2 class="region-list-heading" tabindex="-1">人物档案</h2><p class="operator-coverage">'+coverage+'</p></div><div class="people-filters"><label for="people-query">检索人物</label><input id="people-query" type="search" placeholder="姓名、别名、组织、职业或技能" value="'+esc(query)+'"><details class="operator-filter-details"><summary>筛选地区、职业与星级</summary><div class="operator-filter-grid"><label>关联地区<select id="people-region"><option value="all">全部地区</option>'+countries.map(c=>'<option value="'+c.id+'"'+(region===c.id?' selected':'')+'>'+esc(c.name)+'</option>').join('')+'<option value="unmapped"'+(region==='unmapped'?' selected':'')+'>未关联固定地区</option></select></label><label>职业<select id="people-profession"><option value="all">全部职业</option>'+['先锋','近卫','重装','狙击','术师','医疗','辅助','特种'].map(x=>'<option>'+x+'</option>').join('')+'</select></label><label>星级<select id="people-rarity"><option value="all">全部星级</option>'+[1,2,3,4,5,6].map(n=>'<option value="'+n+'">'+n+' 星</option>').join('')+'</select></label><label>条目范围<select id="people-kind"><option value="all">人物与干员</option><option value="operator">仅干员</option><option value="npc">仅非干员</option></select></label></div><p>职业与星级按任一收录形态匹配。</p></details></div><p class="person-boundary">包含限定、联动、机器人、异格及职业切换。地区联系不等于国籍或现居地。</p><div id="people-results">'+peopleListHTML(query,region)+'</div>','P / '+characters.length);
    updateMarkers();showArchive();resetMap();archive.querySelector('h2').focus({preventScroll:true});
  }
  function operatorFormsHTML(p,formId){
    if(!p.forms?.length)return '';
    const f=p.forms.find(f=>f.charId===formId)||p.forms[0];
    return '<section class="operator-form-picker">'+(p.forms.length>1?'<label for="operator-form-select">选择干员形态</label><select id="operator-form-select">'+p.forms.map(x=>'<option value="'+esc(x.charId)+'"'+(x.charId===f.charId?' selected':'')+'>'+esc(x.name)+' · '+esc(x.profession)+'</option>').join('')+'</select>':'')+'<div class="operator-current-class"><span>'+f.rarity+' 星</span><span>'+esc(f.profession)+'</span><span>'+esc(f.branch)+'</span><span>'+esc(f.position)+'</span></div></section>';
  }
  function selectedOperatorForm(){
    return state.characterDetail?.forms.find(f=>f.charId===state.characterForm);
  }
  function selectedOperatorArt(){
    const f=selectedOperatorForm();return f?.artwork.find(a=>a.stage===state.characterArt)||f?.artwork[0];
  }
  function syncOperatorStage(){
    const p=characterById.get(state.character),active=state.view==='character'&&p?.operator&&state.archiveVisible;
    workspace.classList.toggle('operator-open',Boolean(active));
    viewport.inert=Boolean(active);
    const element=$('operator-stage');element.hidden=!active;
    if(!active){element.innerHTML='';delete element.dataset.key;return;}
    const f=selectedOperatorForm(),art=selectedOperatorArt(),key=[p.id,f?.charId,art?.path].join('|');
    if(element.dataset.key===key)return;
    element.dataset.key=key;
    element.innerHTML=art?'<div class="operator-stage-title"><span>官方立绘</span><strong>'+esc(f.name)+'</strong><small>'+esc(art.label)+'</small></div><img class="operator-stage-image" data-operator-art src="'+esc(art.path)+'" width="'+art.width+'" height="'+art.height+'" alt="'+esc(f.name+' · '+art.label)+'" decoding="async"><p class="operator-stage-note">游戏原始立绘 · <a href="'+esc(art.originalUrl)+'" target="_blank" rel="noopener noreferrer">查看完整原图 ↗</a></p>':'<div class="operator-stage-loading" role="status">正在载入立绘与档案…</div>';
    bindOperatorImageErrors(element);
    if(art)reveal(element.querySelector('img'),6,180);
  }
  function bindOperatorImageErrors(element){
    element.querySelectorAll('[data-operator-art]').forEach(img=>img.addEventListener('error',()=>{
      img.hidden=true;
      const note=document.createElement('p');note.className='operator-image-error';note.textContent='立绘暂未载入，可以通过原图链接查看。';img.after(note);
    },{once:true}));
  }
  function dossierFactsHTML(rows,className='operator-dossier-facts'){
    return '<dl class="'+className+'">'+rows.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value||'未公开')+'</dd></div>').join('')+'</dl>';
  }
  function operatorArtControlsHTML(f,art){
    return '<div class="operator-art-controls"><span>立绘</span><div role="group" aria-label="选择立绘">'+f.artwork.map(a=>'<button data-operator-art-stage="'+a.stage+'" aria-pressed="'+(a.path===art.path)+'">'+esc(a.label)+'</button>').join('')+'</div><a href="'+esc(art.originalUrl)+'" target="_blank" rel="noopener noreferrer">原图 ↗</a></div>';
  }
  function operatorDossierHTML(data,f){
    const art=selectedOperatorArt();
    const artwork='<div class="operator-desktop-art-controls">'+operatorArtControlsHTML(f,art)+'</div><p class="operator-art-credit">立绘来源：<a href="'+esc(art.sourcePage)+'" target="_blank" rel="noopener noreferrer">PRTS 游戏素材库 ↗</a>'+(f.artists.length?' · 画师 '+f.artists.map(esc).join('、'):'')+'</p>';
    const basics='<section class="operator-dossier-section" id="operator-facts"><h3>基础档案 <small>'+esc(f.code)+'</small></h3>'+dossierFactsHTML(Object.entries(f.profile))+'</section>';
    const evaluation=f.evaluation.length?'<section class="operator-dossier-section" id="operator-evaluation"><h3>能力评估</h3>'+dossierFactsHTML(f.evaluation.map(x=>[x.label,x.value]),'operator-evaluation')+'<p class="operator-fine-print">档案原有评语与遮蔽字段按原记录保留。</p></section>':'';
    const clinical=f.clinical.length?'<details class="operator-dossier-disclosure"><summary>临床诊断记录</summary>'+dossierFactsHTML(f.clinical.map(x=>[x.label,x.value]))+'<p class="operator-fine-print">指标对应当前形态所引用的档案时期。</p></details>':'';
    const biography=data.biography.length?'<details class="operator-dossier-disclosure operator-biography" id="operator-biography"><summary>人物经历与日常 <small>含早期档案信息</small></summary><p class="operator-fine-print">根据早期公开档案独立整理，涉及个人经历。</p>'+data.biography.map(s=>'<article><h4>'+esc(s.heading)+'</h4><p>'+esc(s.text)+'</p><small>依据：'+s.sourceChapters.map(esc).join('、')+'</small></article>').join('')+'</details>':'';
    const talents=f.talents.length?'<h4 class="operator-subheading">天赋</h4>'+f.talents.map(t=>'<article class="operator-ability"><h4>'+esc(t.name)+'<small>精英 '+t.phase+' · Lv.'+t.level+'</small></h4>'+(t.description?'<p>'+esc(t.description)+'</p>':'')+'</article>').join(''):'';
    const skills=f.skills.length?'<h4 class="operator-subheading">技能</h4>'+f.skills.map(s=>'<article class="operator-ability"><h4>'+esc(s.name)+'<small>技能 '+s.skillLevel+' 级</small></h4>'+(s.description?'<p>'+esc(s.description)+'</p>':'<p>完整效果见游戏内说明。</p>')+'<div class="operator-skill-values"><span>所需技力 '+s.spCost+'</span><span>初始技力 '+s.initialSP+'</span>'+(s.duration>0?'<span>持续 '+s.duration+' 秒</span>':'')+'</div></article>').join(''):'';
    const abilities='<details class="operator-dossier-disclosure" id="operator-abilities"><summary>战斗能力 <small>'+esc(f.profession+' · '+f.branch)+'</small></summary>'+(f.trait?'<p class="operator-trait">'+esc(f.trait)+'</p>':'')+talents+skills+'<p class="operator-fine-print">天赋采用最高精英阶段、潜能 1 的记录；技能标明所用等级，数值未叠加模组与信赖。</p></details>';
    const credits='<details class="operator-dossier-disclosure"><summary>画师与配音</summary>'+dossierFactsHTML([...(f.artists.length?[['立绘画师',f.artists.join('、')]]:[]),...f.voices.map(v=>[v.language+'配音',v.names.join('、')])])+'</details>';
    const directory='<details class="operator-dossier-disclosure"><summary>完整档案目录 <small>'+f.chapters.length+' 篇</small></summary><ul class="operator-chapter-list">'+f.chapters.map(c=>'<li><span>'+esc(c.title)+'</span><small>'+(c.unlockType==='TRUST'?'信赖 '+esc(c.unlockValue)+'%':c.unlockType==='EVOLVE'?'精英 '+esc(c.unlockValue):'')+'</small></li>').join('')+'</ul><a class="operator-source-button" href="'+esc(f.wiki)+'" target="_blank" rel="noopener noreferrer">前往 PRTS 阅读完整档案 ↗</a></details>';
    return artwork+'<nav class="operator-section-nav" aria-label="人物档案内容"><button data-person-jump="operator-facts">基础档案</button><button data-person-jump="operator-evaluation">能力评估</button>'+(data.biography.length?'<button data-person-jump="operator-biography">人物经历</button>':'')+'<button data-person-jump="operator-abilities">战斗能力</button></nav>'+basics+evaluation+clinical+biography+abilities+credits+directory+'<p class="operator-snapshot">资料快照 '+esc(data.collectedAt)+' · 切换形态可查看对应记录。</p>';
  }
  function renderLoadedOperatorDossier(){
    const target=$('operator-dossier'),f=selectedOperatorForm();if(!target||!f)return;
    const y=archive.scrollTop;
    target.innerHTML=operatorDossierHTML(state.characterDetail,f);target.setAttribute('aria-busy','false');
    const hero=$('operator-mobile-hero'),art=selectedOperatorArt();
    hero.innerHTML='<figure class="operator-mobile-art"><img data-operator-art src="'+esc(art.path)+'" alt="'+esc(f.name+' · '+art.label)+'" width="'+art.width+'" height="'+art.height+'" decoding="async"><figcaption>官方立绘 · '+esc(art.label)+'</figcaption></figure>'+operatorArtControlsHTML(f,art);
    bindOperatorImageErrors(target);bindOperatorImageErrors(hero);syncOperatorStage();archive.scrollTop=y;
  }
  function loadOperatorDossier(p){
    const request=++operatorRequest;
    if(!operatorDetailCache.has(p.id)){
      const task=fetch('operator-details/'+encodeURIComponent(p.id)+'.json').then(response=>{if(!response.ok)throw new Error('Dossier unavailable');return response.json();}).then(data=>{if(data.id!==p.id||!Array.isArray(data.forms))throw new Error('Unexpected dossier');return data;}).catch(error=>{operatorDetailCache.delete(p.id);throw error;});
      operatorDetailCache.set(p.id,task);
    }
    operatorDetailCache.get(p.id).then(data=>{
      if(request!==operatorRequest||state.view!=='character'||state.character!==p.id)return;
      state.characterDetail=data;renderLoadedOperatorDossier();
    }).catch(()=>{
      if(request!==operatorRequest||state.view!=='character'||state.character!==p.id)return;
      const target=$('operator-dossier');if(target){target.setAttribute('aria-busy','false');target.innerHTML='<p class="operator-load-error" role="status">详细档案暂未载入。</p><button class="operator-retry" data-operator-retry>重新载入</button><a class="operator-source-button" href="'+esc(p.forms.find(f=>f.charId===state.characterForm)?.wiki||p.forms[0].wiki)+'" target="_blank" rel="noopener noreferrer">查看来源档案 ↗</a>';}
      $('operator-mobile-hero').innerHTML='';
      $('operator-stage').innerHTML='<p class="operator-stage-loading">立绘暂未载入，可在档案中重试或查看来源。</p>';
    });
  }
  function openCharacter(id,{fromCountry=null,formId=null}={}){
    const p=characterById.get(id);if(!p)return;
    const activeForm=p.forms?.find(f=>f.charId===formId)||p.forms?.[0];
    state.view='character';state.character=id;state.characterOrigin=fromCountry;state.characterForm=activeForm?.charId;state.characterArt='base';state.characterDetail=null;state.selected=null;state.tour=null;updateHash('person/'+id+(activeForm&&activeForm.charId!==p.forms[0].charId?'/'+activeForm.charId:''));
    const origin=byId.get(fromCountry);
    const facts=[['档案身份',p.kind],['种族',p.race],[p.placeLabel||'档案出身地',p.birthplace],...(p.baseFacts||[]).filter(f=>['性别','设定性别','生日','出厂日','身高','高度'].includes(f.label)).map(f=>[f.label,f.value])];
    const regionLinks=p.regionRelations.map(r=>{
      const country=byId.get(r.regionId);return country?'<button class="person-region" data-country="'+country.id+'"><span><strong>'+esc(country.name)+'</strong><small>'+esc(r.relation)+'</small></span><span>'+esc(r.note)+'</span></button>':'';
    }).join('');
    setArchive((origin?'<button class="back-link" data-person-return="'+origin.id+'">← '+esc(origin.name)+' · 人物</button>':'<button class="back-link" data-action="people">← 人物索引</button>')+
      '<div class="person-cover">'+personAvatar(activeForm||p,'person-avatar-large')+'<div><span class="eyebrow">人物档案</span><h2 class="person-title" tabindex="-1">'+esc(p.name)+'</h2><div class="person-en">'+esc(p.en)+'</div></div></div>'+
      (p.operator?operatorFormsHTML(p,state.characterForm)+'<div id="operator-mobile-hero" class="operator-mobile-hero"><p class="operator-loading">正在载入立绘…</p></div>':'')+
      '<p class="person-role">'+esc(p.role)+'</p><p class="person-summary">'+esc(p.summary)+'</p>'+
      (p.operator?'<div id="operator-dossier" aria-busy="true"><p class="operator-loading" role="status">正在载入立绘与详细档案…</p></div>':'<dl class="person-facts">'+facts.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+esc(value||'未公开')+'</dd></div>').join('')+'</dl>')+
      (p.aliases.length?'<section class="person-section"><h3>别名与异格名称</h3><p>'+p.aliases.map(esc).join('、')+'</p></section>':'')+
      '<section class="person-section"><h3>组织与团体联系</h3><div class="person-orgs">'+(p.organizations.length?p.organizations.map(org=>'<button data-people-query="'+esc(org)+'">'+esc(org)+'</button>').join(''):'<p>所引基础资料未明确记录。</p>')+'</div><small>任职、阵营与合作关系依来源语境记录。点选可查看相关人物。</small></section>'+
      '<section class="person-section"><h3>与大地的联系</h3>'+(regionLinks||'<p>当前资料未将此人物关联到地图中的固定地区。</p>')+'<small>出生地、活动与组织联系分别记录，不代表国籍或当前坐标。</small></section>'+
      (p.notes.length?'<section class="person-section"><h3>阅读范围</h3>'+p.notes.map(note=>'<p>'+esc(note)+'</p>').join('')+'</section>':'')+
      '<section class="person-section person-sources"><h3>资料来源</h3><ol>'+p.sources.map(source=>'<li><a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.title)+' ↗</a></li>').join('')+'</ol></section><button class="person-share" data-action="copy">复制人物链接</button>','P / '+String(characters.indexOf(p)+1).padStart(3,'0'));
    updateMarkers();showArchive();resetMap();archive.querySelector('h2').focus({preventScroll:true});
    if(p.operator){
      if(mobile()){$('archive').classList.add('sheet-expanded');$('sheet-expand').setAttribute('aria-expanded','true');$('sheet-expand').setAttribute('aria-label','收起档案');$('sheet-expand').querySelector('b').textContent='收起档案';syncSheetGeometry();}
      loadOperatorDossier(p);
    }
  }
  function openConcept(id){
    const c=concepts.find(c=>c.id===id);if(!c)return;
    state.view='concept';state.selected=null;state.character=null;state.tour=null;updateHash('concept/'+id);
    setArchive('<button class="back-link" data-action="world">← 世界设定</button><div class="concept-detail">'+conceptArt(c)+'<span class="eyebrow">世界设定</span><h2 tabindex="-1">'+esc(c.name)+'</h2><small>'+esc(c.en)+'</small><p>'+esc(c.body)+'</p><a href="'+esc(c.source)+'" target="_blank" rel="noopener noreferrer">阅读设定来源 ↗</a></div>','W / '+pad(concepts.indexOf(c)+1));
    updateMarkers();showArchive();resetMap();archive.querySelector('h2').focus({preventScroll:true});
  }
  function sourceRefs(c,ids) {
    const sources=c.dossier?.sources || [];
    return '<div class="source-refs">参考 '+(ids || []).map(id=>{
      const index=sources.findIndex(s=>s.id===id),source=sources[index];
      return source?'<a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer" aria-label="来源 '+(index+1)+'：'+esc(source.title)+'">['+(index+1)+']</a>':'';
    }).join(' ')+'</div>';
  }
  function dossierHTML(c) {
    const d=c.dossier;
    if(!d)return '<p class="country-intro">'+esc(c.intro)+'</p><p class="country-detail">'+esc(c.detail)+'</p><div class="focus-block"><small>观察线索</small><p>'+esc(c.focus)+'</p></div>';
    const tabs=[['overview','概览',''],['places','地点',d.places.length],['organizations','势力',d.organizations.length],['people','人物',regionPeople(c.id).length],['reading','阅读',d.reading.length]];
    const tabbar='<div class="dossier-tabs" role="tablist" aria-label="'+esc(c.name)+'档案分类">'+tabs.map(([id,label,count])=>{
      const selected=state.countryPane===id;
      return '<button role="tab" data-pane="'+id+'" id="tab-'+c.id+'-'+id+'" aria-controls="pane-'+c.id+'-'+id+'" aria-selected="'+selected+'" tabindex="'+(selected?'0':'-1')+'">'+label+(count!==''?'<small>'+count+'</small>':'')+'</button>';
    }).join('')+'</div>';
    const overview='<p class="country-intro">'+esc(c.intro)+'</p>'+d.sections.map(section=>'<section class="detail-section"><h3>'+esc(section.title)+'</h3><p>'+esc(section.body)+'</p>'+sourceRefs(c,section.sourceIds)+'</section>').join('')+
      '<div class="focus-block"><small>观察线索</small><p>'+esc(c.focus)+'</p></div>';
    const places='<p class="pane-intro">认识这片地区的具体地点。移动城市的位置会随迁徙改变，以下条目不另设固定坐标。</p><div class="entry-list">'+d.places.map((place,index)=>'<article id="entry-'+c.id+'-places-'+index+'"><div class="entry-heading"><h3>'+esc(place.name)+'</h3><span>'+esc(place.kind)+'</span></div><p>'+esc(place.description)+'</p>'+sourceRefs(c,place.sourceIds)+'</article>').join('')+'</div>';
    const organizations='<p class="pane-intro">从组织与地方力量理解社会。其身份和活动范围以所引资料的故事时期为准。</p><div class="entry-list">'+d.organizations.map((org,index)=>'<article id="entry-'+c.id+'-organizations-'+index+'"><h3>'+esc(org.name)+'</h3><p>'+esc(org.description)+'</p>'+sourceRefs(c,org.sourceIds)+'</article>').join('')+'</div>';
    const reading='<p class="pane-intro">想继续了解这里，可以从这些篇目开始。下方链接会离开本站，目标页面可能直接包含剧情。</p><div class="reading-list">'+d.reading.map((item,index)=>'<a id="entry-'+c.id+'-reading-'+index+'" class="reading-card" href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer"><span class="reading-warning">外部资料 · 含背景剧透</span><h3>'+esc(item.title)+' <span aria-hidden="true">↗</span></h3><p>'+esc(item.note)+'</p></a>').join('')+'</div>';
    const people='<p class="pane-intro">与本地区有档案出生地、组织或活动联系的人物；不表示国籍、现居地或地图坐标。</p><div class="person-list">'+(regionPeople(c.id).map(p=>personRow(p,{countryId:c.id})).join('')||'<p class="empty-state">本批资料尚未收录关联人物。</p>')+'</div>';
    const panes={overview,places,organizations,people,reading};
    const body=tabs.map(([id])=>'<div class="dossier-pane" role="tabpanel" tabindex="0" id="pane-'+c.id+'-'+id+'" aria-labelledby="tab-'+c.id+'-'+id+'"'+(state.countryPane!==id?' hidden':'')+'>'+panes[id]+'</div>').join('');
    const notes=d.notes.length?'<details class="dossier-notes"><summary>资料范围与版本说明</summary>'+d.notes.map(note=>'<p>'+esc(note)+'</p>').join('')+'</details>':'';
    const sources='<details class="dossier-sources"><summary>参考来源（'+d.sources.length+'）</summary><ol>'+d.sources.map(source=>'<li><a href="'+esc(source.url)+'" target="_blank" rel="noopener noreferrer">'+esc(source.title)+' ↗</a></li>').join('')+'</ol></details>';
    return tabbar+body+notes+sources;
  }
  function setCountryPane(id,{focus=false}={}) {
    if(!['overview','places','organizations','people','reading'].includes(id))return;
    state.countryPane=id;
    archive.querySelectorAll('[data-pane]').forEach(b=>{
      const active=b.dataset.pane===id;
      b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;
      if(active&&focus)b.focus({preventScroll:true});
    });
    archive.querySelectorAll('.dossier-pane').forEach(p=>{p.hidden=!p.id.endsWith('-'+id);});
    const pane=archive.querySelector('.dossier-pane:not([hidden])');
    const tabs=archive.querySelector('.dossier-tabs');
    if(pane&&tabs){
      const padding=parseFloat(getComputedStyle(archive).paddingTop)||0;
      const top=archive.scrollTop+pane.getBoundingClientRect().top-archive.getBoundingClientRect().top-tabs.offsetHeight-padding-12;
      archive.scrollTop=Math.max(0,top);
      reveal(pane,4,160);
    }
  }
  function renderCountry(c) {
    state.view='country';
    const t=state.tour?tours[state.tour]:null;
    const progress=t?'<div class="tour-progress"><small>'+esc(t.title)+' · 第 '+(state.tourIndex+1)+' / '+t.ids.length+' 站</small>'+
      '<div class="tour-stops" aria-label="导览站点">'+t.ids.map((id,i) => '<button data-tour-stop="'+i+'" class="'+(i===state.tourIndex?'active':'')+'" aria-label="第 '+(i+1)+' 站 '+esc(byId.get(id).name)+'"'+(i===state.tourIndex?' aria-current="step"':'')+'>'+pad(i+1)+'</button>').join('')+'</div>'+
      '<div class="tour-navigation"><button class="secondary" data-action="tour-prev" '+(state.tourIndex===0?'disabled':'')+'>上一站</button><button data-action="tour-next">'+(state.tourIndex===t.ids.length-1?'完成这段巡旅 ✓':'下一站 '+esc(byId.get(t.ids[state.tourIndex+1]).name)+' →')+'</button></div><p class="country-note route-note">虚线表示阅读顺序，不代表实际道路。</p></div>':'';
    setArchive('<button class="back-link" data-action="'+(t?'overview':'list')+'">← '+(t?'返回导览':'地区索引')+'</button>'+
      '<div class="country-cover"><div class="country-kicker"><span>地区档案 / '+pad(c.index)+'</span><span>'+esc(labels[c.group])+'</span></div>'+
      '<div class="country-identity"><div class="country-emblem" aria-hidden="true">'+emblem(c.id)+'</div><div><h2 class="country-title" tabindex="-1">'+esc(c.name)+'</h2><div class="country-en">'+esc(c.en)+'</div></div></div>'+
      '<div class="country-tags">'+c.tags.map(tag => '<span>'+esc(tag)+'</span>').join('')+'</div></div>'+
      dossierHTML(c)+
      '<div class="country-actions"><button class="bookmark-button '+(saved.has(c.id)?'saved':'')+'" data-action="bookmark" aria-pressed="'+saved.has(c.id)+'"><span>'+(saved.has(c.id)?'◆':'◇')+'</span>'+(saved.has(c.id)?'已标记此地':'标记此地')+'</button>'+
      '<a class="source-link" href="'+esc(c.source)+'" target="_blank" rel="noopener noreferrer">参考资料 ↗</a></div>'+
      '<div class="country-utilities"><button data-action="locate">在地图上定位</button><button data-action="copy">复制地区链接</button></div>'+
      '<p class="country-note">轮廓按此版底图描边。外部资料可能包含剧情信息。</p>'+progress,
      c.name+' / '+String(c.index).padStart(3,'0'));
  }
  function setLabels(visible) {
    state.showLabels=visible;
    markers.classList.toggle('hide-labels',!visible);markers.inert=!visible;
    $('labels-toggle').classList.toggle('on',visible);
    $('labels-toggle').setAttribute('aria-pressed',String(visible));
  }
  function selectCountry(id,{focus=true,tour=false,open=true,pane='overview'}={}) {
    const c=byId.get(id);if(!c)return;
    if(!tour)state.tour=null;
    state.character=null;state.selected=id;state.countryPane=pane;visited.add(id);persist(visitedKey,visited);
    setLabels(true);renderCountry(c);updateHash(id);syncCounts();updateMarkers();
    if(open){showArchive();archive.querySelector('.country-title').focus({preventScroll:true});}
    if(focus)focusOn(c);
  }
  function toggleBookmark() {
    if(!state.selected)return;
    const id=state.selected;
    if(saved.has(id))saved.delete(id);else saved.add(id);
    const stored=persist(storageKey,saved);
    renderCountry(byId.get(id));updateMarkers();syncCounts();
    archive.querySelector('[data-action="bookmark"]').focus({preventScroll:true});
    toast(!stored?'当前浏览器无法保存，标记暂存于本次浏览':saved.has(id)?'已加入我的标记':'已移除探索标记');
  }
  function randomCountry() {
    const unread=countries.filter(c => !visited.has(c.id));
    const pool=unread.length?unread:countries.filter(c => c.id!==state.selected);
    const c=pool[Math.floor(Math.random()*pool.length)];
    setFilter('all',false);selectCountry(c.id);
  }
  function startTour(id) {
    if(!tours[id])return;
    state.tour=id;state.tourIndex=0;setFilter('all',false);selectCountry(tours[id].ids[0],{tour:true});
  }
  function tourStep(index) {
    const t=tours[state.tour];if(!t||index<0||index>=t.ids.length)return;
    state.tourIndex=index;selectCountry(t.ids[index],{tour:true});
  }
  function tourNext() {
    const t=tours[state.tour];if(!t)return;
    if(state.tourIndex===t.ids.length-1){overview({reset:true});toast('这段巡旅已完成，下一站由你决定');return;}
    tourStep(state.tourIndex+1);
  }
  async function copyLocation() {
    try {
      await navigator.clipboard.writeText(location.href);
      toast(state.view==='character'?'已复制人物链接':'已复制地区链接');
    } catch { toast('请从浏览器地址栏复制当前档案链接'); }
  }
  const actions={
    overview:() => overview({reset:true}),list:() => renderList(),saved:() => renderList(true),people:() => renderPeople(),world:() => openDialog('world-dialog'),
    about:() => openDialog('about-dialog'),bookmark:toggleBookmark,
    'tour-next':tourNext,'tour-prev':() => tourStep(state.tourIndex-1),
    'clear-filter':() => {setFilter('all',false);renderList();},
    random:randomCountry,copy:copyLocation,
    locate:() => {closeArchive({restore:false});focusOn(byId.get(state.selected));viewport.focus({preventScroll:true});}
  };
  archive.addEventListener('keydown',e=>{
    const tab=e.target.closest('[data-pane]');if(!tab)return;
    const ids=['overview','places','organizations','people','reading'],index=ids.indexOf(tab.dataset.pane);
    const next=e.key==='ArrowRight'?(index+1)%ids.length:e.key==='ArrowLeft'?(index+ids.length-1)%ids.length:e.key==='Home'?0:e.key==='End'?ids.length-1:null;
    if(next!==null){e.preventDefault();setCountryPane(ids[next],{focus:true});}
  });
  archive.addEventListener('click',e => {
    const artStage=e.target.closest('[data-operator-art-stage]');
    if(artStage){state.characterArt=artStage.dataset.operatorArtStage;renderLoadedOperatorDossier();$(mobile()?'operator-mobile-hero':'operator-dossier').querySelector('[data-operator-art-stage="'+state.characterArt+'"]').focus({preventScroll:true});return;}
    if(e.target.closest('[data-operator-retry]')){loadOperatorDossier(characterById.get(state.character));return;}
    const jump=e.target.closest('[data-person-jump]');if(jump){const target=$(jump.dataset.personJump);if(target){if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({block:'start',behavior:reduceMotion()?'auto':'smooth'});target.tabIndex=-1;target.focus({preventScroll:true});}return;}
    const person=e.target.closest('[data-character]');
    if(e.target.closest('[data-people-more]')){state.peopleLimit+=60;updatePeopleList({reset:false});return;}
    if(person){openCharacter(person.dataset.character,{fromCountry:person.dataset.characterOrigin});return;}
    const back=e.target.closest('[data-person-return]');if(back){selectCountry(back.dataset.personReturn,{pane:'people'});return;}
    const related=e.target.closest('[data-people-query]');if(related){renderPeople({query:related.dataset.peopleQuery});return;}
    const pane=e.target.closest('[data-pane]');
    if(pane){setCountryPane(pane.dataset.pane);return;}
    const country=e.target.closest('[data-country]'),tour=e.target.closest('[data-tour]'),stop=e.target.closest('[data-tour-stop]');
    if(country){selectCountry(country.dataset.country);return;}
    if(tour){startTour(tour.dataset.tour);return;}
    if(stop){tourStep(Number(stop.dataset.tourStop));return;}
    actions[e.target.closest('[data-action]')?.dataset.action]?.();
  });
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click',() => {
    if(b.dataset.view==='overview')overview({reset:true});
    else if(b.dataset.view==='people')renderPeople();
    else {if(b.dataset.view==='list')setFilter('all',false);renderList(b.dataset.view==='saved');}
  }));
  archive.addEventListener('input',e=>{if(e.target.id==='people-query'){state.peopleQuery=e.target.value;updatePeopleList();}});
  archive.addEventListener('change',e=>{const key={'people-region':'peopleRegion','people-profession':'peopleProfession','people-rarity':'peopleRarity','people-kind':'peopleKind'}[e.target.id];if(key){state[key]=e.target.value;updatePeopleList();}});
  archive.addEventListener('change',e=>{if(e.target.id==='operator-form-select'){openCharacter(state.character,{fromCountry:state.characterOrigin,formId:e.target.value});$('operator-form-select').focus({preventScroll:true});}});
  const regionData=window.TERRA_REGIONS||{},surface=$('map-surface'),regionLayers=$('region-layers');
  function emblem(id){
    const r=regionData[id],size=r.imageSize||[510,510];
    return '<svg class="original-insignia" viewBox="'+r.viewBox.join(' ')+'" aria-hidden="true"><image href="'+r.insignia+'" width="'+size[0]+'" height="'+size[1]+'"/></svg>';
  }
  let surfaceMatrix=null;
  function projectionMatrix(){return surfaceMatrix||(surfaceMatrix=new DOMMatrix(getComputedStyle(surface).transform));}
  function projectedPoint(coords,z=0){
    const q=projectionMatrix().transformPoint(new DOMPoint(coords[0]-640,coords[1]-411,z));
    return [640+q.x/q.w,411+q.y/q.w];
  }
  function positionMarkers(){
    for(const el of markers.children){
      const c=byId.get(el.dataset.id),q=projectedPoint(c.coords);
      el.style.left=q[0]+'px';el.style.top=q[1]+'px';
    }
  }
  function hoverRegion(id){
    if(!matchMedia('(hover: hover) and (pointer: fine)').matches)return;
    regionLayers.querySelectorAll('.region-tile').forEach(el=>el.classList.toggle('hovered',el.dataset.id===id));
    positionMarkers();
  }
  countries.forEach(c=>{
    const r=regionData[c.id];
    const geometry=window.TERRA_GEOMETRY?.regions[c.id];
    r.bounds=geometry?.bounds||{width:120,height:90};
    if(!geometry)return;
    const d=geometry.path,el=document.createElementNS('http://www.w3.org/2000/svg','svg');
    r.tile=el;
    el.setAttribute('viewBox','0 0 1280 822');el.setAttribute('class','region-tile');el.dataset.id=c.id;
    el.innerHTML='<defs><clipPath id="clip-'+c.id+'"><path clip-rule="evenodd" d="'+d+'"/></clipPath></defs>'+
      '<image class="region-texture" href="assets/terra-base.jpg" width="1280" height="822" clip-path="url(#clip-'+c.id+')"/>'+
      '<path class="region-face" fill-rule="evenodd" data-region="'+c.id+'" d="'+d+'"/><path class="region-halo" d="'+d+'"/>';
    el.querySelector('.region-face').addEventListener('pointerenter',()=>hoverRegion(c.id));
    el.querySelector('.region-face').addEventListener('pointerleave',()=>hoverRegion(null));
    regionLayers.appendChild(el);
  });
  countries.forEach(c => {
    const b=document.createElement('button');
    b.className='marker';b.dataset.id=c.id;b.dataset.anchor=c.coords.join(',');b.style.left=c.coords[0]+'px';b.style.top=c.coords[1]+'px';
    b.setAttribute('aria-label',c.name+'，查看地理档案');b.setAttribute('aria-pressed','false');b.title=c.name;
    b.innerHTML='<span class="pin" aria-hidden="true">'+emblem(c.id)+'</span><span class="marker-text">'+esc(c.name)+'<small>'+esc(c.en)+'</small></span>';
    b.addEventListener('pointerenter',()=>hoverRegion(c.id));
    b.addEventListener('pointerleave',()=>hoverRegion(null));
    b.addEventListener('click',e => {
      e.stopPropagation();if(didDrag)return;
      if(state.filter!=='all'&&state.filter!==c.group)setFilter('all',false);
      selectCountry(c.id);
    });
    markers.appendChild(b);
  });
  const markerEls=[...markers.querySelectorAll('.marker')];
  function updateMarkers() {
    const activeTour=state.tour?tours[state.tour].ids:null;
    markerEls.forEach(el => {
      const c=byId.get(el.dataset.id),selected=c.id===state.selected;
      el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));
      el.classList.toggle('dimmed',!selected&&(
        (state.filter!=='all'&&state.filter!==c.group)||
        (activeTour&&!activeTour.includes(c.id))||
        (state.view==='saved'&&!saved.has(c.id))
      ));
      el.querySelector('.saved-dot')?.remove();el.querySelector('.tour-stop')?.remove();
      if(saved.has(c.id))el.insertAdjacentHTML('beforeend','<span class="saved-dot" aria-hidden="true"></span>');
      if(activeTour?.includes(c.id))el.insertAdjacentHTML('beforeend','<span class="tour-stop" aria-hidden="true">'+(activeTour.indexOf(c.id)+1)+'</span>');
    });
    $('tour-route').innerHTML=activeTour?'<path d="'+activeTour.map((id,i)=>(i?'L':'M')+byId.get(id).coords.join(' ')).join(' ')+'"/>':'';
    regionLayers.querySelectorAll('.region-tile').forEach(el=>{
      const c=byId.get(el.dataset.id),active=c.id===state.selected;
      el.classList.toggle('selected',active);el.classList.toggle('subdued',!!state.selected&&!active);
      el.classList.toggle('filtered',state.filter!=='all'&&state.filter!==c.group);
    });
    workspace.classList.toggle('country-selected',!!state.selected);
    const c=byId.get(state.selected);
    $('selection-context').hidden=!c;
    $('selected-name').textContent=c?c.name:'';
    panel.classList.toggle('has-selection',!!c);
    positionMarkers();layoutLabels();
  }
  function layoutLabels() {
    if(!initialized)return;
    markerEls.forEach(el=>el.classList.remove('compact','label-left','icon-only'));
    const priority=['ursus','yan','columbia','victoria','sargon','iberia','sami','kazimierz','leithanien','higashi','kazdel','rim-billiton','kjerag','siracusa','laterano','bolivar','minos','siesta'];
    const score=el=>el.dataset.id===state.selected?-100:el.querySelector('.tour-stop')?-50:el.classList.contains('dimmed')?100+priority.indexOf(el.dataset.id):priority.indexOf(el.dataset.id);
    const rects=[],overlaps=r=>rects.some(q=>r.left<q.right+5&&r.right>q.left-5&&r.top<q.bottom+4&&r.bottom>q.top-4);
    for(const el of markerEls.slice().sort((a,b)=>score(a)-score(b))){
      let placed=false;
      for(const [compact,left] of [[false,false],[false,true],[true,false],[true,true]]){
        el.classList.toggle('compact',compact);el.classList.toggle('label-left',left);
        const r=el.getBoundingClientRect();if(!overlaps(r)){rects.push(r);placed=true;break;}
      }
      if(!placed){el.classList.add('compact','icon-only');el.classList.remove('label-left');rects.push(el.getBoundingClientRect());}
    }
  }
  function setFilter(filter,render=true) {
    if(!labels[filter])return;
    state.filter=filter;
    document.querySelectorAll('[data-filter]').forEach(b => {
      const active=b.dataset.filter===filter;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
    });
    const count=countries.filter(c => filter==='all'||c.group===filter).length;
    $('map-count').textContent=count+(filter==='all'?' 个区域':' 个匹配');
    if(initialized)updateMarkers();
    if(render)renderList(false,{open:!mobile()});
  }
  document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click',()=>{
    state.tour=null;setFilter(b.dataset.filter);
    toast(b.dataset.filter==='all'?'显示全部 18 个地区':labels[b.dataset.filter]+'：'+countries.filter(c=>c.group===b.dataset.filter).length+' 个地区');
  }));
  document.querySelectorAll('[data-style]').forEach(b => b.addEventListener('click',()=>{
    state.style=b.dataset.style;panel.classList.toggle('original',state.style==='original');
    document.querySelectorAll('[data-style]').forEach(x=>{
      x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));
    });
    if(!document.documentElement.dataset.palettePreview)try{localStorage.setItem('terra-map-style',state.style);}catch{}
  }));
  function bounds(x,y,s) {
    const w=viewport.clientWidth,h=viewport.clientHeight,mx=w*.35,my=h*.3;
    return {x:Math.max(w-1280*s-mx,Math.min(mx,x)),y:Math.max(h-822*s-my,Math.min(my,y)),scale:s};
  }
  function applyCamera() {
    stage.style.transform='translate('+camera.x+'px,'+camera.y+'px) scale('+camera.scale+')';
    stage.style.setProperty('--inverse-scale',1/camera.scale);
    $('zoom-label').textContent=Math.round(camera.scale/camera.fit*100)+'%';
  }
  function animateTo(target,ms=280) {
    cancelAnimationFrame(animation);
    const start={...camera},time=performance.now();cameraTarget=target;
    if(!canAnimate()||ms===0){Object.assign(camera,target);cameraTarget=null;applyCamera();layoutLabels();return;}
    const tick=now=>{
      const t=Math.min(1,(now-time)/ms),e=ms>=240?t*t*(3-2*t):1-Math.pow(1-t,3);
      camera.x=start.x+(target.x-start.x)*e;camera.y=start.y+(target.y-start.y)*e;camera.scale=start.scale+(target.scale-start.scale)*e;
      applyCamera();if(t<1)animation=requestAnimationFrame(tick);else{cameraTarget=null;layoutLabels();}
    };
    animation=requestAnimationFrame(tick);
  }
  function availableMapWidth(){return viewport.clientWidth-(!mobile()&&state.archiveVisible?$('archive').offsetWidth+52:0);}
  function resetMap(animate=true){
    positionMarkers();
    const w=availableMapWidth(),h=viewport.clientHeight;
    camera.fit=Math.max(.15,Math.min((w-(mobile()?20:110))/1430,(h-(mobile()?260:190))/920))*(mobile()?1.25:1);
    const s=camera.fit,top=mobile()?132:110,bottom=mobile()?155:105;
    animateTo({x:(w-1280*s)/2,y:top+(h-top-bottom-822*s)/2,scale:s},animate?280:0);
  }
  function focusOn(c){
    if(!c)return;
    const w=availableMapWidth(),r=regionData[c.id].bounds;
    let s=Math.min(Math.max(camera.fit*1.85,.8),Math.max(.3,(w-100)/(r.width+120)),Math.max(.3,(viewport.clientHeight-240)/(r.height+100)));
    const q=projectedPoint(c.coords);
    let available=viewport.clientHeight-125;
    if(mobile()&&state.archiveVisible){const sheet=$('archive'),expanded=sheet.classList.contains('sheet-expanded');available=viewport.clientHeight-parseFloat(sheet.style.getPropertyValue(expanded?'--sheet-height':'--sheet-preview'));s=Math.min(s,1.05);}
    const y=(110+Math.max(available,180))/2;
    animateTo({x:w*.5-q[0]*s,y:y-q[1]*s,scale:s});
  }
  function zoomAt(factor,x=viewport.clientWidth/2,y=viewport.clientHeight/2) {
    const s=Math.max(camera.fit*.7,Math.min(camera.fit*4,camera.scale*factor));
    animateTo(bounds(x-(x-camera.x)*s/camera.scale,y-(y-camera.y)*s/camera.scale,s),160);
  }
  $('perspective-toggle').addEventListener('click',()=>{
    state.tilt=!state.tilt;panel.classList.toggle('flat-map',!state.tilt);surfaceMatrix=null;
    const b=$('perspective-toggle');b.classList.toggle('on',state.tilt);b.setAttribute('aria-pressed',String(state.tilt));b.setAttribute('aria-label',state.tilt?'切换为平面地图':'切换为立体地图');
    positionMarkers();resetMap(false);if(state.selected)focusOn(byId.get(state.selected));
  });
  $('zoom-in').addEventListener('click',()=>zoomAt(1.3));
  $('zoom-out').addEventListener('click',()=>zoomAt(1/1.3));
  $('map-reset').addEventListener('click',()=>resetMap());
  $('selection-reset').addEventListener('click',()=>{closeArchive({restore:false});overview({reset:true});});
  $('labels-toggle').addEventListener('click',()=>setLabels(!state.showLabels));
  $('fullscreen').addEventListener('click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else if($('app').requestFullscreen)await $('app').requestFullscreen();else toast('当前浏览器不支持全屏');}
    catch{toast('当前环境暂不支持全屏');}
  });
  viewport.addEventListener('wheel',e=>{
    e.preventDefault();cancelAnimationFrame(animation);cameraTarget=null;
    const r=viewport.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,s=Math.max(camera.fit*.7,Math.min(camera.fit*4,camera.scale*Math.exp(-e.deltaY*.0012)));
    Object.assign(camera,bounds(x-(x-camera.x)*s/camera.scale,y-(y-camera.y)*s/camera.scale,s));applyCamera();layoutLabels();
  },{passive:false});
  viewport.addEventListener('dblclick',e=>{
    if(e.target.closest('.marker,[data-region]'))return;
    const r=viewport.getBoundingClientRect();zoomAt(1.5,e.clientX-r.left,e.clientY-r.top);
  });
  viewport.addEventListener('pointerdown',e=>{
    if(e.target.closest('.marker')||e.button>0)return;
    cancelAnimationFrame(animation);cameraTarget=null;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});viewport.setPointerCapture(e.pointerId);didDrag=false;
    if(pointers.size===1){pointerOrigin={x:e.clientX,y:e.clientY,cx:camera.x,cy:camera.y,region:e.target.closest('[data-region]')?.dataset.region};viewport.classList.add('dragging');}
    if(pointers.size===2){const[a,b]=[...pointers.values()],r=viewport.getBoundingClientRect();pinchOrigin={distance:Math.hypot(a.x-b.x,a.y-b.y),scale:camera.scale,mx:(a.x+b.x)/2-r.left,my:(a.y+b.y)/2-r.top,cx:camera.x,cy:camera.y};}
  });
  viewport.addEventListener('pointermove',e=>{
    if(!pointers.has(e.pointerId))return;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size===2&&pinchOrigin){
      const[a,b]=[...pointers.values()],r=viewport.getBoundingClientRect(),s=Math.max(camera.fit*.7,Math.min(camera.fit*4,pinchOrigin.scale*Math.hypot(a.x-b.x,a.y-b.y)/Math.max(1,pinchOrigin.distance))),mx=(a.x+b.x)/2-r.left,my=(a.y+b.y)/2-r.top;
      Object.assign(camera,bounds(mx-(pinchOrigin.mx-pinchOrigin.cx)*s/pinchOrigin.scale,my-(pinchOrigin.my-pinchOrigin.cy)*s/pinchOrigin.scale,s));didDrag=true;
    }else if(pointerOrigin){
      const dx=e.clientX-pointerOrigin.x,dy=e.clientY-pointerOrigin.y;
      if(Math.abs(dx)+Math.abs(dy)>4)didDrag=true;
      Object.assign(camera,bounds(pointerOrigin.cx+dx,pointerOrigin.cy+dy,camera.scale));
    }
    applyCamera();
  });
  function endPointer(e){
    const clickedRegion=e.type==='pointerup'&&pointers.size===1&&!didDrag?pointerOrigin?.region:null;
    pointers.delete(e.pointerId);
    if(pointers.size===1){const p=[...pointers.values()][0];pointerOrigin={x:p.x,y:p.y,cx:camera.x,cy:camera.y};pinchOrigin=null;}
    if(pointers.size===0){pointerOrigin=null;pinchOrigin=null;viewport.classList.remove('dragging');layoutLabels();setTimeout(()=>{didDrag=false;},0);}
    if(clickedRegion){if(state.filter!=='all')setFilter('all',false);selectCountry(clickedRegion);}
  }
  viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);
  function closeSearch(){
    searchHits=[];searchIndex=-1;$('search-results').hidden=true;
    $('search').setAttribute('aria-expanded','false');$('search').removeAttribute('aria-activedescendant');
  }
  const searchTypes={all:'全部',person:'人物',country:'地区',place:'地点',organization:'势力',concept:'设定',reading:'篇目'};
  function renderSearch({reset=true}={}){
    const q=$('search').value.trim();
    const allHits=librarySearch.query(q,{scope:searchScope});
    if(reset)searchLimit=30;
    searchHits=allHits.slice(0,searchLimit);searchIndex=-1;$('search').removeAttribute('aria-activedescendant');
    $('search-results').innerHTML='<div class="search-scopes" role="group" aria-label="搜索范围">'+Object.entries(searchTypes).map(([id,label])=>'<button data-search-scope="'+id+'" aria-pressed="'+(searchScope===id)+'">'+label+'</button>').join('')+'</div><div class="search-caption" role="status">'+(q?'找到 '+allHits.length+(searchScope==='person'?' 位人物':searchScope==='country'?' 个地区':' 条'+(searchScope==='all'?'资料':searchTypes[searchScope])):'检索姓名、别名、组织与世界设定')+'</div><div id="search-options" role="listbox" aria-label="资料搜索结果">'+
      (searchHits.length?searchHits.map((entry,i)=>'<button class="search-result entity-result" id="search-option-'+i+'" role="option" aria-selected="false" tabindex="-1" data-search-key="'+esc(entry.key)+'">'+(entry.type==='person'?personAvatar(characterById.get(entry.id)):'<span class="search-kind-icon" aria-hidden="true">'+esc(searchTypes[entry.type])+'</span>')+'<span class="search-result-copy"><strong>'+esc(entry.name)+'</strong><small>'+esc(entry.en||entry.context)+'</small></span><span class="result-tag">'+esc(searchTypes[entry.type])+'</span></button>').join(''):'<div class="no-results">没有匹配资料。<br>试试「阿米娅」「博士」「罗德岛」或「源石」。</div>')+'</div>'+
      (allHits.length>searchHits.length?'<button class="search-more" data-search-more>再显示 30 条 · 共 '+allHits.length+' 条</button>':'');
    $('search-results').hidden=false;$('search').setAttribute('aria-expanded','true');
  }
  function chooseSearch(entry){
    if(!entry)return;
    const q=normalize($('search').value);
    setFilter('all',false);$('search').value='';closeSearch();$('search').blur();
    if(entry.type==='person'){const p=characterById.get(entry.id),form=p.forms?.find(f=>[f.name,f.en,f.ja].some(n=>normalize(n)===q));openCharacter(entry.id,{formId:form?.charId});return;}
    if(entry.type==='concept'){openConcept(entry.id);return;}
    selectCountry(entry.countryId,{pane:entry.pane||'overview'});
    if(entry.pane){const target=$('entry-'+entry.countryId+'-'+entry.pane+'-'+entry.entryIndex);if(target)target.scrollIntoView({block:'nearest'});}
  }
  $('search').addEventListener('input',()=>renderSearch());$('search').addEventListener('focus',()=>{if(mobile())closeArchive({restore:false});renderSearch();});
  $('search-results').addEventListener('click',e=>{
    const scope=e.target.closest('[data-search-scope]');if(scope){searchScope=scope.dataset.searchScope;renderSearch();$('search-results').querySelector('[data-search-scope="'+searchScope+'"]').focus();return;}
    if(e.target.closest('[data-search-more]')){searchLimit+=30;renderSearch({reset:false});return;}
    const b=e.target.closest('[data-search-key]');if(b)chooseSearch(librarySearch.byKey.get(b.dataset.searchKey));
  });
  $('search').addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.stopPropagation();closeSearch();$('search').blur();return;}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();if($('search-results').hidden)renderSearch();if(!searchHits.length)return;
      searchIndex=searchIndex===-1?(e.key==='ArrowDown'?0:searchHits.length-1):(searchIndex+(e.key==='ArrowDown'?1:-1)+searchHits.length)%searchHits.length;
      const options=$('search-results').querySelectorAll('[role="option"]');
      options.forEach((b,i)=>{b.classList.toggle('keyboard-active',i===searchIndex);b.setAttribute('aria-selected',String(i===searchIndex));});
      const selected=options[searchIndex];$('search').setAttribute('aria-activedescendant',selected.id);selected.scrollIntoView({block:'nearest'});
    }
    if(e.key==='Enter'&&searchHits.length&&!$('search-results').hidden){e.preventDefault();chooseSearch(searchHits[Math.max(0,searchIndex)]);}
    if(e.key==='Tab'){$('search').removeAttribute('aria-activedescendant');}
  });
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.search-wrap'))closeSearch();});
  document.querySelector('.search-wrap').addEventListener('focusout',()=>setTimeout(()=>{if(!document.activeElement?.closest('.search-wrap'))closeSearch();},0));
  // Official artwork is retained byte-for-byte; SVG viewBox only removes transparent padding.
  const officialConceptArt={
    'originium':['originium.png','284 258 431 507'],
    'originium-arts':['originium-arts.png','335 65 325 729'],
    'nomadic-city':['nomadic-city.png','284 363 457 340'],
    'infected':['infected.png','350 362 295 350'],
    'rhodes-island':['rhodes-island-world.png','333 292 330 440']
  };
  const conceptIcons={
    'catastrophe':'<path d="M7 17c0-8 12-13 18-5 10-3 17 10 9 15H9c-8-1-8-10-2-10Z"/><path d="m24 27-8 12h8l-5 9M9 31l-4 7m29-6-4 7"/>',
    'oripathy':'<path d="M15 5h16v10h10v16H31v10H15V31H5V15h10Z"/><path d="m20 14 8 8-5 12-7-11Z"/>',
    'catastrophe-messenger':'<circle cx="24" cy="24" r="18"/><path d="m29 15-3 12-11 6 6-13ZM24 2v4m0 36v4M2 24h4m36 0h4"/>',
    'races':'<circle cx="17" cy="14" r="6"/><circle cx="33" cy="17" r="5"/><path d="M5 39v-6c0-7 5-11 12-11s12 4 12 11v6M31 26c8-1 12 4 12 10v3M10 39h14m10 0h5"/>',
    'industrial-arts':'<path d="M7 39h34V22l-10 5V16l-10 6V10H9ZM9 10V5h12v5M12 30h3m7 0h3m7 0h3M12 35h3m7 0h3m7 0h3"/>'
  };
  function conceptArt(c){
    const art=officialConceptArt[c.id];
    if(art)return '<span class="concept-art official-art"><svg viewBox="'+art[1]+'" aria-hidden="true"><image href="assets/official/'+art[0]+'" width="1024" height="1024"/></svg></span>';
    return '<span class="concept-art schematic-art"><svg viewBox="0 0 48 48" aria-hidden="true">'+conceptIcons[c.id]+'</svg></span>';
  }
  $('concept-grid').innerHTML=concepts.map(c=>'<article class="concept-card"><div class="concept-card-header">'+conceptArt(c)+'<div><h3>'+esc(c.name)+'</h3><small>'+esc(c.en)+'</small></div></div><p>'+esc(c.body)+'</p><a href="'+esc(c.source)+'" target="_blank" rel="noopener noreferrer">阅读设定来源 ↗</a></article>').join('');
  let dialogTrigger=null;
  function openDialog(id){
    closeSearch();const dialog=$(id);if(dialog.open)return;
    dialogTrigger=document.activeElement;dialog.showModal();dialog.querySelector('.dialog-close').focus();
    if(canAnimate())dialog.animate([{opacity:0,transform:'translateY(10px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:220,easing:'cubic-bezier(.22,1,.36,1)'}).finished.catch(()=>{});
  }
  function closeDialog(dialog){
    if(!dialog.open||dialog.dataset.closing)return;
    if(!canAnimate()){dialog.close();return;}
    dialog.dataset.closing='true';
    dialog.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(6px) scale(.99)'}],{duration:160,easing:'cubic-bezier(.22,1,.36,1)'}).finished.catch(()=>{}).then(()=>{
      if(dialog.open)dialog.close();delete dialog.dataset.closing;
    });
  }
  document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeDialog($(b.dataset.close))));
  document.querySelectorAll('dialog').forEach(d=>{
    d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(d);}});
    d.addEventListener('cancel',e=>{e.preventDefault();closeDialog(d);});
    d.addEventListener('close',()=>{delete d.dataset.closing;if(dialogTrigger?.isConnected)dialogTrigger.focus({preventScroll:true});});
  });
  $('nav-concepts').addEventListener('click',()=>openDialog('world-dialog'));
  $('nav-sources').addEventListener('click',()=>openDialog('about-dialog'));
  $('help-button').addEventListener('click',()=>openDialog('help-dialog'));
  function goHome(){closeArchive({restore:false});overview({reset:true});closeSearch();$('search').value='';}
  $('nav-map').addEventListener('click',goHome);
  $('brand-home').addEventListener('click',e=>{e.preventDefault();goHome();});
  $('dock-index').addEventListener('click',()=>renderList());
  $('dock-characters').addEventListener('click',()=>{closeSearch();renderPeople();});
  $('dock-saved').addEventListener('click',()=>{setFilter('all',false);renderList(true);});
  $('dock-random').addEventListener('click',randomCountry);
  $('mobile-archive-button').addEventListener('click',()=>{overview();showArchive();resetMap();});
  $('archive-close').addEventListener('click',()=>closeArchive());
  $('sheet-expand').addEventListener('click',()=>{
    const expanded=$('archive').classList.toggle('sheet-expanded');
    $('sheet-expand').setAttribute('aria-expanded',String(expanded));
    $('sheet-expand').setAttribute('aria-label',expanded?'收起档案':'展开档案');
    $('sheet-expand').querySelector('b').textContent=expanded?'收起档案':'展开阅读';
    syncSheetGeometry();
    if(!expanded&&state.selected)focusOn(byId.get(state.selected));
  });
  document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]'))return;
    if(e.target.matches('input,textarea,[contenteditable]'))return;
    if(e.key==='/'){e.preventDefault();closeArchive({restore:false});$('search').focus();return;}
    if(e.key==='Escape'){closeArchive();closeSearch();return;}
    if(e.target!==viewport&&e.target!==document.body)return;
    if(e.key==='Home'){e.preventDefault();resetMap();return;}
    if(e.key==='+'||e.key==='='){e.preventDefault();zoomAt(1.25);return;}
    if(e.key==='-'){e.preventDefault();zoomAt(.8);return;}
    const direction={ArrowLeft:[60,0],ArrowRight:[-60,0],ArrowUp:[0,60],ArrowDown:[0,-60]}[e.key];
    if(direction){e.preventDefault();animateTo(bounds(camera.x+direction[0],camera.y+direction[1],camera.scale),150);}
  });
  function openHash(id){
    if(byId.has(id)){selectCountry(id);return;}
    if(id==='people'){renderPeople();return;}
    if(id.startsWith('person/')){const [,personId,formId]=id.split('/');if(characterById.has(personId)){openCharacter(personId,{formId});return;}}
    if(id.startsWith('concept/')&&concepts.some(c=>c.id===id.slice(8))){openConcept(id.slice(8));return;}
    goHome();
  }
  window.addEventListener('hashchange',()=>openHash(readHash()));
  let resizeTimer;
  new ResizeObserver(()=>{
    clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{
      syncArchive();resetMap(false);if(state.selected)focusOn(byId.get(state.selected));
    },80);
  }).observe(viewport);
  $('map-image').addEventListener('error',()=>toast('底图加载失败，请刷新页面。地区索引仍可使用。'));
  setColorTheme(document.documentElement.dataset.theme,{persist:false});
  const initialId=readHash();
  initialized=true;updateMotion();overview();syncArchive();resetMap(false);
  try{if(!document.documentElement.dataset.palettePreview&&localStorage.getItem('terra-map-style')==='original')document.querySelector('[data-style="original"]').click();}catch{}
  if(initialId)openHash(initialId);
})();
