/* Search entities retain their own identity instead of collapsing into country hits. */
(() => {
  'use strict';
  const normalize=value=>String(value||'').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[\s·・—–_\-.'’“”「」《》()（）]/g,'');
  function create({countries,concepts,characters}) {
    const entries=[];
    const add=(entry,terms=[],body='')=>{
      entries.push({...entry,names:[entry.name,entry.en,...(entry.aliases||[])].filter(Boolean).map(normalize),terms:normalize(terms.join(' ')),body:normalize(body)});
    };
    for(const c of countries){
      add({key:'country:'+c.id,type:'country',id:c.id,name:c.name,en:c.en,countryId:c.id,context:c.tags.join(' · ')},c.tags,[c.intro,c.detail,...(c.dossier?.sections||[]).map(s=>s.body)].join(' '));
      for(const [pane,type] of [['places','place'],['organizations','organization'],['reading','reading']]){
        (c.dossier?.[pane]||[]).forEach((item,index)=>add({key:type+':'+c.id+':'+index,type,name:item.name||item.title,countryId:c.id,pane,entryIndex:index,context:c.name},[c.name,c.en,item.kind||''],item.description||item.note||''));
      }
    }
    for(const c of concepts)add({key:'concept:'+c.id,type:'concept',id:c.id,name:c.name,en:c.en,context:'世界设定'},[],c.body);
    for(const p of characters){
      const regions=(p.regionIds||[]).map(id=>countries.find(c=>c.id===id)?.name).filter(Boolean);
      add({key:'person:'+p.id,type:'person',id:p.id,name:p.name,en:p.en,aliases:p.aliases,portrait:p.portrait,context:p.role||p.organizations.join(' · ')},[...p.organizations,...p.tags,p.race,p.birthplace,...regions,...(p.forms||[]).flatMap(f=>[f.name,f.en,f.ja,f.profession,f.branch,f.rarity+'星',f.code,...f.skills])],p.summary);
    }
    const byKey=new Map(entries.map(e=>[e.key,e]));
    function query(value,{scope='all'}={}){
      const words=String(value||'').trim().split(/\s+/).filter(Boolean).map(normalize),whole=normalize(value);
      return entries.filter(e=>scope==='all'||e.type===scope).map((e,order)=>{
        if(!words.length)return {entry:e,score:e.type==='country'?20:e.type==='person'?10:0,order};
        if(!words.every(w=>e.names.some(n=>n.includes(w))||e.terms.includes(w)||e.body.includes(w)))return null;
        const exact=e.names.some(n=>n===whole),prefix=e.names.some(n=>n.startsWith(whole)),nameMatch=e.names.some(n=>n.includes(whole));
        const score=exact?1000:prefix?700:nameMatch?500:e.terms.includes(whole)?250:100;
        return {entry:e,score,order};
      }).filter(Boolean).sort((a,b)=>b.score-a.score||a.order-b.order).map(r=>r.entry);
    }
    return {entries,byKey,query};
  }
  window.TERRA_SEARCH={create,normalize};
})();
