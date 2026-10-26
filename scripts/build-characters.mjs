import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const data=JSON.parse(readFileSync(new URL('data/characters.json',root),'utf8'));
const regions=new Set(JSON.parse(readFileSync(new URL('data/expanded-content.json',root),'utf8')).countries.map(c=>c.id));
const ids=new Set(),names=new Set();
const formIds=new Set();
if(data.characters.length<60)throw new Error('Character archive is incomplete.');
for(const p of data.characters){
  if(!/^[a-z0-9-]+$/.test(p.id)||ids.has(p.id)||names.has(p.name))throw new Error('Duplicate/invalid character: '+p.id);
  ids.add(p.id);names.add(p.name);
  for(const key of ['name','en','kind','race','birthplace','role','summary'])if(typeof p[key]!=='string'||!p[key])throw new Error('Missing '+key+': '+p.id);
  for(const key of ['aliases','organizations','regionIds','regionRelations','sources','notes','tags'])if(!Array.isArray(p[key]))throw new Error('Invalid '+key+': '+p.id);
  if(!p.sources.length||p.sources.some(s=>!s.title||new URL(s.url).protocol!=='https:'))throw new Error('Missing HTTPS source: '+p.id);
  if(p.regionIds.some(id=>!regions.has(id))||p.regionRelations.some(r=>!p.regionIds.includes(r.regionId)||!r.note||!r.relation))throw new Error('Invalid region relationship: '+p.id);
  if(p.regionIds.some(id=>!p.regionRelations.some(r=>r.regionId===id)))throw new Error('Unexplained region relationship: '+p.id);
  if(['coords','latitude','longitude','anchor'].some(key=>key in p))throw new Error('Characters must not imply fixed coordinates.');
  if(p.portrait&&(!/^assets\/characters\/[a-z0-9-]+\.png$/.test(p.portrait)||!existsSync(new URL('dist/'+p.portrait,root))))throw new Error('Missing portrait: '+p.id);
  if(p.operator){
    if(!p.forms?.length)throw new Error('Missing operator forms: '+p.id);
    for(const f of p.forms){
      if(formIds.has(f.charId)||!f.name||!f.profession||!f.branch||!Number.isInteger(f.rarity)||f.rarity<1||f.rarity>6||!Object.keys(f.profile).length||!Array.isArray(f.skills))throw new Error('Invalid operator form: '+f.charId);
      formIds.add(f.charId);
      if(!f.portrait||!existsSync(new URL('dist/'+f.portrait,root)))throw new Error('Missing form portrait: '+f.charId);
    }
  }
}
if(data.meta.operatorCoverage&&formIds.size!==data.meta.operatorCoverage.operatorFormCount)throw new Error('Incomplete operator coverage.');
const assets=JSON.parse(readFileSync(new URL('data/character-portrait-sources.json',root),'utf8')).assets.filter(a=>a.status==='ok');
for(const a of assets){
  const bytes=readFileSync(new URL('dist/assets/characters/'+a.file,root));
  if(createHash('sha256').update(bytes).digest('hex')!==a.sha256)throw new Error('Portrait modified: '+a.file);
}
writeFileSync(new URL('dist/characters-data.js',root),'// Source-grounded character summaries; original source URLs are retained.\nwindow.TERRA_CHARACTERS = '+JSON.stringify({meta:data.meta,characters:data.characters},null,2).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n');
console.log('Characters built: '+data.characters.length+' people, '+data.characters.reduce((n,p)=>n+p.aliases.length,0)+' aliases, '+assets.length+' original portraits.');
