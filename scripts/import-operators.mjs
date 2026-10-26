import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const write=(path,value)=>writeFileSync(new URL(path,root),JSON.stringify(value,null,2)+'\n');
const input=read('data/operator-source.json'),curated=read('data/curated-characters.json');
const summaryArg=process.argv.indexOf('--summaries');
if(summaryArg!==-1)write('data/operator-summaries.json',JSON.parse(readFileSync(process.argv[summaryArg+1],'utf8')));
let summaries={characters:[]};
try{summaries=read('data/operator-summaries.json');}catch{}
const summaryById=new Map(summaries.characters.map(p=>[p.baseCharId,p]));
const oldByName=new Map(curated.characters.map(p=>[p.name,p]));
const avatars=new Map(read('data/character-portrait-sources.json').assets.filter(a=>a.status==='ok').map(a=>[a.charId,a]));
const countries=read('data/expanded-content.json').countries;
const countryNames={columbia:'哥伦比亚',victoria:'维多利亚',ursus:'乌萨斯',yan:'炎',higashi:'东国',leithanien:'莱塔尼亚',kazimierz:'卡西米尔',sargon:'萨尔贡',iberia:'伊比利亚',laterano:'拉特兰',siracusa:'叙拉古',kjerag:'谢拉格',sami:'萨米',bolivar:'玻利瓦尔','rim-billiton':'雷姆必拓',kazdel:'卡兹戴尔',minos:'米诺斯',siesta:'汐斯塔'};
function regionFor(value){
  const text=(value||'').trim();
  if(/^(龙门|炎$|炎国|大炎|炎-)/.test(text))return 'yan';
  return Object.keys(countryNames).find(id=>id!=='yan'&&(text===countryNames[id]||text.startsWith(countryNames[id]+'（')||text.startsWith(countryNames[id]+'-')||text.startsWith(countryNames[id]+'境内')));
}
const nationNames=new Set([...Object.values(countryNames),'炎-龙门','阿戈尔','维多利亚-塔拉']);
const unique=values=>[...new Set(values.filter(Boolean).map(v=>String(v).trim()).filter(Boolean))];
const factsOrder=['性别','设定性别','生日','出厂日','身高','高度','战斗经验','工程经验','工作经验','出厂时间','制造商','型号','重量','体重','年龄','感染情况'];
const groups=input.groups.map(group=>{
  const first=group.forms[0],old=oldByName.get(first.name),editorial=summaryById.get(group.baseCharId);
  const p=old?structuredClone(old):{id:'op-'+group.baseCharId.replace(/^char_/,'').replaceAll('_','-'),name:first.name,en:first.en,aliases:[],organizations:[],regionIds:[],regionRelations:[],notes:[],sources:[],tags:[]};
  const basics=first.profile;
  p.kind='干员';p.operator=true;p.baseCharId=group.baseCharId;
  p.forms=group.forms.map(form=>{
    const {sortIndex,...published}=form,avatar=avatars.get(form.charId);
    return {...published,...(avatar?{portrait:'assets/characters/'+avatar.file}:{})};
  });
  p.aliases=unique([...p.aliases,...p.forms.flatMap(f=>[f.name,f.en,f.ja])]).filter(a=>a!==p.name&&a!==p.en);
  p.race=basics['种族']||p.race||(basics['型号']?'机械单位':'档案未记载');
  p.birthplace=basics['出身地']||basics['产地']||p.birthplace||'档案未记载';
  p.placeLabel=basics['产地']?'档案产地':'档案出身地';
  p.baseFacts=factsOrder.filter(label=>basics[label]).map(label=>({label,value:basics[label]}));
  p.role=old?.role||editorial?.role||first.profession+' · '+first.branch;
  p.summary=old?.summary||editorial?.summary||p.name+'是'+first.profession+'干员，分支为'+first.branch+'。基础档案记录其'+(basics['产地']?'产地':'出身地')+'为'+p.birthplace+'。';
  p.tags=unique([...p.tags,...(editorial?.tags||[]),...p.forms.flatMap(f=>[f.profession,f.branch,...f.tags])]);
  p.organizations=unique([...p.organizations.flatMap(v=>v.split(',')),...p.forms.flatMap(f=>[f.group,f.team,f.faction].flatMap(v=>(v||'').split(',')).map(v=>v.trim()).filter(v=>!nationNames.has(v)))]);
  for(const form of p.forms){
    const origin=form.profile['出身地']||form.profile['产地'];
    for(const [value,relation,note] of [[origin,form.profile['产地']?'产地（基础档案）':'出身地（基础档案）','基础档案记录为“'+origin+'”。'],[form.nation,'国家或地区阵营（资料字段）','公开阵营字段记录为“'+form.nation+'”，不据此推定国籍或现居地。']]){
      const regionId=regionFor(value);
      if(regionId&&!p.regionIds.includes(regionId)){p.regionIds.push(regionId);p.regionRelations.push({regionId,relation,note});}
    }
  }
  p.notes=p.notes.filter(n=>!n.includes('regionIds')&&!n.includes('regionRelations')&&!n.includes(' id'));
  if(group.baseCharId==='char_446_aroma')p.notes.push('基础档案将出身地记为叙拉古，客观履历则提及来自哥伦比亚。保留来源中的不同口径，不据其中一项推定国籍。');
  if(group.baseCharId==='char_134_ifrit')p.notes.push('所引基础档案的种族字段存在遮蔽文字，按原字段保留。');
  const avatar=avatars.get(group.baseCharId);if(avatar)p.portrait='assets/characters/'+avatar.file;
  const urls=new Set(p.sources.map(s=>s.url));
  for(const f of p.forms){if(!urls.has(f.wiki)){p.sources.push({title:'PRTS · '+f.name+' / 干员档案',url:f.wiki,kind:'wiki-profile'});urls.add(f.wiki);}}
  p.sources.push({title:'公开游戏数据 · 基础档案与形态资料（固定版本）',url:'https://github.com/Kengxxiao/ArknightsGameData/tree/'+input.revision+'/zh_CN/gamedata/excel',kind:'game-data',evidence:'基础档案字段、职业、分支、星级和技能名按固定提交提取；与 PRTS 干员一览逐项核对。'});
  p.profileLevel=old?'curated':editorial?'summarized':'basic';
  return p;
});
const generatedByName=new Map(groups.map(p=>[p.name,p]));
const characters=curated.characters.map(p=>generatedByName.get(p.name)||{...p,operator:false});
for(const p of groups)if(!characters.some(x=>x.id===p.id))characters.push(p);
const formIds=groups.flatMap(p=>p.forms.map(f=>f.charId));
const expected=input.groups.flatMap(g=>g.forms.map(f=>f.charId));
const coverage={collectedAt:input.collectedAt,revision:input.revision,operatorCount:groups.length,operatorFormCount:formIds.length,nonOperatorCount:characters.length-groups.length,wikiFormCount:input.wikiFormCount,missingForms:expected.filter(id=>!formIds.includes(id)),extraForms:formIds.filter(id=>!expected.includes(id)),duplicateForms:formIds.filter((id,i)=>formIds.indexOf(id)!==i),excludedSpecialModeCount:input.excludedSpecialModeCount,summaryCount:groups.filter(p=>p.profileLevel!=='basic').length,basePortraitCount:groups.filter(p=>p.portrait).length,formPortraitCount:groups.reduce((n,p)=>n+p.forms.filter(f=>f.portrait).length,0)};
if(coverage.missingForms.length||coverage.extraForms.length||coverage.duplicateForms.length||coverage.operatorFormCount!==input.operatorFormCount||coverage.wikiFormCount!==input.operatorFormCount)throw new Error('Operator coverage is incomplete.');
if(countries.length!==18)throw new Error('Unexpected region source.');
write('data/operator-coverage.json',coverage);
write('data/characters.json',{meta:{...curated.meta,researchedAt:input.collectedAt,scope:'全干员基础资料；按游戏异格和职业切换分组，保留独立非干员档案。',operatorCoverage:coverage,editorNote:'基础字段来自公开游戏数据固定版本，与 PRTS 全干员名录逐项核对。人物导读独立编写；不将阵营或出身地推作国籍与固定坐标。'},characters});
console.log(JSON.stringify(coverage));
