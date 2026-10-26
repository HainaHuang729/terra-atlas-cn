import {readFileSync,writeFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('../data/expanded-content.json',import.meta.url),'utf8'));
if(data.countries.length!==18) throw new Error('Expected 18 geographic dossiers.');
const ids=new Set();
for(const country of data.countries){
  if(ids.has(country.id))throw new Error('Duplicate dossier: '+country.id);
  ids.add(country.id);
  const sourceIds=new Set(country.sources.map(s=>s.id));
  for(const group of ['sections','places','organizations']){
    for(const item of country[group]){
      if(!item.sourceIds.length||item.sourceIds.some(id=>!sourceIds.has(id)))throw new Error('Missing source reference: '+country.id);
    }
  }
  for(const item of [...country.sources,...country.reading]){
    if(new URL(item.url).protocol!=='https:')throw new Error('Expected an HTTPS source.');
  }
}
const published={meta:data.meta,countries:data.countries,concepts:data.concepts};
writeFileSync(new URL('../dist/archive-data.js',import.meta.url),'// Public-source summaries researched with dsh and editorially reviewed.\nwindow.TERRA_ARCHIVE = '+JSON.stringify(published,null,2).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n');
console.log('Archive built: '+data.countries.length+' regions, '+data.concepts.length+' additional concepts.');
