# coding: utf-8
"""Extract factual dossier fields from pinned game tables; never publish raw stories."""
from pathlib import Path
import json,re,sys,hashlib

if len(sys.argv)!=3:raise SystemExit('Usage: python3 scripts/extract-operator-details.py <original-tables-directory> <additional-tables-directory>')
repo=Path(__file__).resolve().parent.parent
original,additional=map(Path,sys.argv[1:])
load=lambda p:json.loads(p.read_text())
for folder,manifest in [(original,'source-manifest.json'),(additional,'additional-source-manifest.json')]:
 for f in load(folder/manifest)['files']:
  if f.get('status')=='failed':continue
  assert hashlib.sha256((folder/f['file']).read_bytes()).hexdigest()==f['sha256'],'Changed source: '+f['file']
chars=load(original/'character_table.json');chars.update(load(original/'char_patch_table.json')['patchChars'])
books=load(original/'handbook_info_table.json')['handbookDict']
skills=load(original/'skill_table.json');skins=load(additional/'skin_table.json')['charSkins'];voice_table=load(additional/'charword_table.json');voices=voice_table['voiceLangDict']
people=[p for p in load(repo/'data/characters.json')['characters'] if p.get('operator')]
clean=lambda text:re.sub(r'<[^>]*>','',text or '').replace('\\n','\n').strip()
def fields(text):
 return [{'label':m[1],'value':m[2].strip().split('\n')[0].strip()} for m in re.finditer(r'【([^】]+)】([^【]*)',clean(text)) if m[2].strip()]
def selected_chapters(base,charid):
 out=[]
 for chapter in books.get(charid,books.get(base,{})).get('storyTextAudio',[]):
  for story in chapter['stories']:
   if not story.get('patchIdList') or charid in story['patchIdList']:
    out.append((chapter['storyTitle'],story));break
 return out
def description(text,blackboard):
 values={v['key'].lower():v.get('valueStr') or v['value'] for v in blackboard or []}
 def replace(m):
  key,_,fmt=m[1].partition(':');sign=-1 if key.startswith('-') else 1;key=key.lstrip('-').lower()
  if key not in values:return m[0]
  value=values[key]
  if isinstance(value,str):return value
  value*=sign
  if '%' in fmt:value*=100
  digits=len(fmt.split('.')[-1].rstrip('%')) if '.' in fmt else 0
  rendered=(f'{value:.{digits}f}' if fmt else f'{value:g}')
  return rendered+('%' if '%' in fmt else '')
 result=re.sub(r'\{([^{}]+)\}',replace,clean(text))
 return '' if '{' in result or '}' in result else result
def stage(v):return int(v.get('unlockCondition',{}).get('phase','PHASE_0').split('_')[-1])
forms={};unresolved=[]
langs={key:value['name'] for key,value in voice_table['voiceLangTypeDict'].items()}
for p in people:
 for form in p['forms']:
  cid=form['charId'];char=chars[cid];chapters=selected_chapters(p['baseCharId'],cid)
  chapter_text={title:s['storyText'] for title,s in chapters}
  evaluation=next((fields(chapter_text[t]) for t in ['综合体检测试','综合性能检测结果','综合能力测试'] if t in chapter_text),[])
  evaluation=[f for f in evaluation if len(f['value'])<60]
  clinical=fields(chapter_text.get('临床诊断分析',chapter_text.get('特殊疾病筛查','')))
  clinical=[f for f in clinical if f['label'] in ['体细胞与源石融合率','血液源石结晶密度'] and len(f['value'])<60]
  talents=[]
  for group in char.get('talents') or []:
   candidates=[c for c in (group.get('candidates') or []) if c.get('requiredPotentialRank',0)==0 and not c.get('isHideTalent')]
   if not candidates:continue
   t=max(candidates,key=lambda c:(stage(c),c.get('unlockCondition',{}).get('level',1)))
   if not t.get('name'):continue
   text=description(t.get('description'),t.get('blackboard'))
   if t.get('description') and not text:unresolved.append({'charId':cid,'kind':'talent','name':t['name']})
   talents.append({'name':clean(t['name']),'description':text,'phase':stage(t),'level':t['unlockCondition']['level']})
  skill_details=[]
  for entry in char['skills']:
   sid=entry.get('skillId')
   if not sid or sid not in skills:continue
   levels=skills[sid]['levels'];index=min(6,len(levels)-1);s=levels[index]
   blackboard=list(s.get('blackboard') or [])
   if not any(v['key'].lower()=='duration' for v in blackboard):blackboard.append({'key':'duration','value':s['duration']})
   text=description(s.get('description'),blackboard)
   if s.get('description') and not text:unresolved.append({'charId':cid,'kind':'skill','name':s['name']})
   skill_details.append({'name':clean(s['name']),'description':text,'skillLevel':index+1,'duration':s['duration'],'spCost':s['spData']['spCost'],'initialSP':s['spData']['initSp']})
  default_skins=[v for k,v in skins.items() if (v.get('tmplId') or v.get('charId'))==cid and '@' not in k]
  artists=list(dict.fromkeys(a for s in default_skins for a in s['displaySkin'].get('drawerList') or []))
  cast=voices.get(cid,{}).get('dict',{})
  if not cast and cid in ['char_1001_amiya2','char_1037_amiya3']:cast=voices.get(p['baseCharId'],{}).get('dict',{})
  cv=[{'language':langs.get(k,k),'names':v.get('cvName') or []} for k,v in cast.items() if v.get('cvName')]
  trait_candidates=[c for c in ((char.get('trait') or {}).get('candidates') or []) if c.get('requiredPotentialRank',0)==0]
  trait=max(trait_candidates,key=stage) if trait_candidates else {}
  forms[cid]={'evaluation':evaluation,'clinical':clinical,'talents':talents,'skills':skill_details,'artists':artists,'voices':cv,'trait':description(trait.get('overrideDescripton') or char.get('description'),trait.get('blackboard')),'chapters':[{'title':title,'unlockType':s.get('unLockType'),'unlockValue':s.get('unLockParam')} for title,s in chapters]}
result={'meta':{'collectedAt':'2026-10-26','revision':load(original/'source-manifest.json')['revision'],'scope':'Factual fields, ability evaluations, clinical metrics, credits and functional combat descriptions; raw narrative archives excluded.','additionalSources':load(additional/'additional-source-manifest.json'),'unresolvedDescriptions':unresolved},'forms':forms}
(repo/'data/operator-detail-source.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'forms':len(forms),'withEvaluation':sum(bool(f['evaluation']) for f in forms.values()),'withClinicalMetrics':sum(bool(f['clinical']) for f in forms.values()),'withArtists':sum(bool(f['artists']) for f in forms.values()),'withVoices':sum(bool(f['voices']) for f in forms.values()),'unresolvedDescriptions':unresolved},ensure_ascii=False))
