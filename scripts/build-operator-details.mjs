import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(readFileSync(new URL(path,root),'utf8'));
const people=read('data/characters.json').characters.filter(p=>p.operator);
const source=read('data/operator-detail-source.json');
const art=read('data/operator-art-sources.json');
const bios=existsSync(new URL('data/operator-biographies.json',root))?read('data/operator-biographies.json').characters:[];
const bioById=new Map(bios.map(p=>[p.baseCharId,p]));
const dir=new URL('dist/operator-details/',root);mkdirSync(dir,{recursive:true});
const assets=art.assets.filter(a=>a.status==='ok');
for(const a of assets){
  if(!/^assets\/operator-art\/[a-z0-9-]+\.png$/.test(a.path))throw new Error('Unsafe art path.');
  const bytes=readFileSync(new URL('dist/'+a.path,root));
  if(createHash('sha256').update(bytes).digest('hex')!==a.sha256)throw new Error('Modified illustration: '+a.file);
  if(new URL(a.originalUrl).hostname!=='media.prts.wiki'||new URL(a.sourcePage).hostname!=='prts.wiki')throw new Error('Unexpected art source.');
}
let formCount=0,biographyCount=0;
for(const p of people){
  const biography=bioById.get(p.baseCharId)?.sections||[];
  if(biography.length)biographyCount++;
  for(const s of biography)if(!s.heading||!s.text||!Array.isArray(s.sourceChapters)||s.text.length>350)throw new Error('Invalid biography: '+p.id);
  const forms=p.forms.map(f=>{
    const extra=source.forms[f.charId];if(!extra)throw new Error('Missing form dossier: '+f.charId);
    const artwork=assets.filter(a=>a.charId===f.charId).map(a=>({stage:a.stage,label:a.label,path:a.path,width:a.width,height:a.height,originalUrl:a.originalUrl,sourcePage:a.sourcePage})).sort((a,b)=>a.stage==='base'?-1:b.stage==='base'?1:0);
    if(!artwork.length)throw new Error('Missing illustration: '+f.charId);
    for(const t of [...extra.talents,...extra.skills])if(/[{}]|<[^>]*>/.test(t.description))throw new Error('Unresolved formatting in '+f.charId);
    formCount++;return {...f,...extra,artwork};
  });
  const data={id:p.id,name:p.name,baseCharId:p.baseCharId,collectedAt:source.meta.collectedAt,revision:source.meta.revision,biography,forms};
  writeFileSync(new URL(p.id+'.json',dir),JSON.stringify(data)+'\n');
}
const coverage={operators:people.length,forms:formCount,illustrations:assets.length,biographies:biographyCount};
writeFileSync(new URL('data/operator-detail-coverage.json',root),JSON.stringify(coverage,null,2)+'\n');
for(const file of ['LICENSE','NOTICE.md'])writeFileSync(new URL('dist/'+file,root),readFileSync(new URL(file,root)));
console.log('Operator dossiers built: '+JSON.stringify(coverage));
