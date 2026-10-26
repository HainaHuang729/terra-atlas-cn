import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const people=read('data/characters.json').characters.filter(p=>p.operator),art=read('data/operator-art-sources.json').assets.filter(a=>a.status==='ok');
const seen=new Set();let biographyCount=0;
for(const p of people){
  const d=read('dist/operator-details/'+p.id+'.json');
  assert.equal(d.id,p.id);assert.equal(d.baseCharId,p.baseCharId);
  assert.deepEqual(d.forms.map(f=>f.charId),p.forms.map(f=>f.charId));
  if(d.biography.length)biographyCount++;
  for(const f of d.forms){
    assert(!seen.has(f.charId));seen.add(f.charId);
    const original=p.forms.find(x=>x.charId===f.charId);
    assert.deepEqual(f.profile,original.profile,'Profile changed for '+f.charId);
    assert.deepEqual(f.skills.map(s=>s.name),original.skills);
    assert(f.artwork.length>0);assert(f.evaluation.length>0);assert(f.artists.length>0);assert(f.voices.length>0);
    for(const a of f.artwork){
      assert(art.some(x=>x.charId===f.charId&&x.path===a.path),'Wrong form artwork: '+f.charId);
      assert(existsSync(new URL('dist/'+a.path,root)));assert(a.width>0&&a.height>0);
      assert.equal(new URL(a.originalUrl).protocol,'https:');
    }
    for(const x of [...f.skills,...f.talents]){
      assert(!/[{}]|<[^>]*>/.test(x.description),'Unresolved ability formatting');
      if('skillLevel' in x)assert(x.skillLevel>=1&&x.skillLevel<=7);
    }
    assert(!JSON.stringify(d).includes('storyText'),'Raw narrative chapters must not be shipped.');
  }
}
const amiya=read('dist/operator-details/amiya.json'),caster=amiya.forms.find(f=>f.charId==='char_002_amiya'),medic=amiya.forms.find(f=>f.charId==='char_1037_amiya3');
assert.equal(caster.profile['身高'],'142cm');assert.equal(medic.profile['身高'],'150cm');assert.equal(medic.profile['战斗经验'],'四年');
assert(caster.evaluation.some(f=>f.label==='源石技艺适应性'&&f.value==='■■'));
assert(medic.artwork.every(a=>a.path.includes('1037-amiya3')));
assert.equal(medic.artists.join('、'),'Mag42');
assert.equal(seen.size,434);assert.equal(people.length,394);assert.equal(art.length,832);
console.log(`Detailed dossier checks passed: ${people.length} people, ${seen.size} forms, ${art.length} illustrations, ${biographyCount} biographies; patch profiles and artwork remain separate.`);
