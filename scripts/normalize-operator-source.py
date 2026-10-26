# coding: utf-8
from pathlib import Path
import json,re,collections,hashlib,sys
if len(sys.argv)!=2:raise SystemExit('Usage: python3 scripts/normalize-operator-source.py <downloaded-source-directory>')
p=Path(sys.argv[1]).resolve()
manifest=json.loads((p/'source-manifest.json').read_text())
for asset in manifest['files']:
 if asset['status']=='ok':assert hashlib.sha256((p/asset['file']).read_bytes()).hexdigest()==asset['sha256'], 'Source hash mismatch: '+asset['file']
load=lambda name:json.loads((p/(name+'.json')).read_text())
c=load('character_table');patch=load('char_patch_table');meta=load('char_meta_table');books=load('handbook_info_table')['handbookDict'];wiki={r['char-id']:r for r in load('prts-roster')};branches=load('uniequip_table')['subProfDict'];skills=load('skill_table')
rows={k:v for k,v in c.items() if not v.get('isNotObtainable') and v['profession'] not in ['TOKEN','TRAP']};rows.update(patch['patchChars'])
assert set(rows)==set(wiki),'Game roster and wiki list disagree'
parent={k:k for k in rows}
def find(k):
 while parent[k]!=k:k=parent[k]
 return k
for ids in list(meta['spCharGroups'].values())+[a['tmplIds'] for a in patch['infos'].values()]:
 for k in ids[1:]:
  if k in parent and ids[0] in parent:parent[find(k)]=find(ids[0])
groups=collections.defaultdict(list)
for k in rows:groups[find(k)].append(k)
prof={'PIONEER':'先锋','WARRIOR':'近卫','TANK':'重装','SNIPER':'狙击','CASTER':'术师','MEDIC':'医疗','SUPPORT':'辅助','SPECIAL':'特种'}
clean=lambda s:re.sub(r'<[^>]*>','',s or '').strip()
def chapter(k,title):
 book=books.get(k)
 if book is None:
  base=find(k);book=books.get(base,{})
 candidates=[]
 for part in book.get('storyTextAudio',[]):
  if part['storyTitle']!=title:continue
  for story in part['stories']:
   allowed=story.get('patchIdList')
   if not allowed or k in allowed:candidates.append(story['storyText'])
 return clean(candidates[0]) if candidates else ''
def basics(text):
 result={}
 for m in re.finditer(r'【([^】]+)】([^【]*)',text):
  key=m.group(1);value=m.group(2).strip()
  if key in ['代号','型号','性别','设定性别','战斗经验','工程经验','出厂时间','工作经验','航海经验','出身地','产地','生日','出厂日','种族','身高','高度','重量','制造商','体重','年龄']:
   result[key]=value
 if '矿石病感染情况' in text:
  tail=text.split('【矿石病感染情况】',1)[1]
  result['感染情况']='非感染者' if '非感染者' in tail else '感染者' if '感染者' in tail else '档案未明确'
 return result
out=[]
for base,ids in groups.items():
 ids.sort(key=lambda k:(k!=base,rows[k]['sortIndex']))
 forms=[]
 for k in ids:
  r=rows[k];w=wiki[k];b=basics(chapter(k,'基础档案'))
  skillNames=[]
  for entry in r['skills']:
   sid=entry.get('skillId')
   if sid and sid in skills:
    name=clean(skills[sid]['levels'][0]['name'])
    if name not in skillNames:skillNames.append(name)
  forms.append({'charId':k,'name':w['zh'],'en':w.get('en') or r['appellation'],'ja':w.get('ja',''),'code':r['displayNumber'],'profession':prof[r['profession']],'branch':branches[r['subProfessionId']]['subProfessionName'],'rarity':int(r['rarity'].split('_')[-1]),'position':'近战位' if r['position']=='MELEE' else '远程位' if r['position']=='RANGED' else r['position'],'tags':r['tagList'] or [],'profile':b,'nation':w.get('nation',''),'group':w.get('group',''),'team':w.get('team',''),'faction':w.get('ingame-faction',''),'skills':skillNames,'obtain':w.get('obtain-method',''),'wiki':'https://prts.wiki/w/'+w['zh'],'sortIndex':r['sortIndex']})
 out.append({'baseCharId':base,'forms':forms})
report={'collectedAt':'2026-10-26','revision':(p/'github-head.txt').read_text().strip(),'operatorFormCount':len(rows),'identityCount':len(groups),'wikiFormCount':len(wiki),'missingInWiki':[],'missingInGame':[],'excludedSpecialModeCount':sum(1 for v in c.values() if v['profession'] not in ['TOKEN','TRAP'] and v.get('isNotObtainable')),'groups':out}
(p/'normalized-operators.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(p/'coverage-report.json').write_text(json.dumps({k:v for k,v in report.items() if k!='groups'},ensure_ascii=False,indent=2)+'\n')
print('Normalized',len(rows),'operator forms into',len(groups),'identities; zero roster differences.')
