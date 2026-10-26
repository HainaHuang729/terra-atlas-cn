from pathlib import Path
from urllib.request import build_opener, ProxyHandler, Request
from urllib.parse import urlencode, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed
import json, hashlib, time, struct, sys

repo=Path(__file__).resolve().parent.parent
if len(sys.argv)!=2:raise SystemExit('Usage: python3 scripts/collect-operator-art.py <metadata-cache-directory>')
out=Path(sys.argv[1]).resolve();out.mkdir(parents=True,exist_ok=True)
forms=[f for p in json.loads((repo/'data/characters.json').read_text())['characters'] for f in p.get('forms',[])]
dest=repo/'dist/assets/operator-art';dest.mkdir(exist_ok=True)
def get(url):
 for attempt in range(3):
  try:
   return build_opener(ProxyHandler({})).open(Request(url,headers={'User-Agent':'TerraAtlas/1.0 (fan reference; provenance retained)'}),timeout=30).read()
  except Exception:
   if attempt==2:raise
   time.sleep(2*(attempt+1))
def query(batch,index):
 cache=out/f'art-api-{index}.json'
 if cache.exists():return json.loads(cache.read_text())
 args={'action':'query','format':'json','prop':'imageinfo','iiprop':'url|sha1|size|mime','iiurlwidth':600,'titles':'|'.join(batch)}
 data=json.loads(get('https://m.prts.wiki/api.php?'+urlencode(args)))
 cache.write_text(json.dumps(data,ensure_ascii=False,indent=2))
 return data
requests=[(f,'base',f'文件:立绘_{f["name"]}_1.png') for f in forms]+[(f,'e2',f'文件:立绘_{f["name"]}_2.png') for f in forms if f['rarity']>=4]
titles=[x[2] for x in requests];pages={}
batches=[titles[i:i+40] for i in range(0,len(titles),40)]
with ThreadPoolExecutor(max_workers=3) as pool:
 for data in pool.map(lambda item:query(item[1],item[0]),enumerate(batches)):
  for page in data.get('query',{}).get('pages',{}).values():pages[page['title'].replace(' ','_')]=page
print('Image metadata collected:',len(pages),'titles',flush=True)
jobs=[];missing=[]
for form,stage,title in requests:
 page=pages.get(title.replace(' ','_'))
 if not page or not page.get('imageinfo'):
  missing.append({'charId':form['charId'],'name':form['name'],'stage':stage,'requestedTitle':title});continue
 info=page['imageinfo'][0]
 actualStage='e2' if unquote(info['url']).endswith('_2.png') else stage
 jobs.append({'charId':form['charId'],'name':form['name'],'stage':actualStage,'label':'精英二' if actualStage=='e2' else '初始立绘','file':form['charId'].replace('_','-')+'-'+actualStage+'.png','sourcePage':info['descriptionurl'],'originalUrl':info['url'],'sourceSha1':info['sha1'],'downloadUrl':info.get('thumburl',info['url']),'sourceSize':[info['width'],info['height']],'requestedTitle':title})
jobs=list({(a['charId'],a['originalUrl']):a for a in jobs}.values())
def download(a):
 try:
  path=dest/a['file']
  body=path.read_bytes() if path.exists() else get(a['downloadUrl'])
  assert body[:8]==b'\x89PNG\r\n\x1a\n','Not a PNG'
  width,height=struct.unpack('>II',body[16:24])
  if not path.exists():path.write_bytes(body)
  return {**a,'path':'assets/operator-art/'+a['file'],'width':width,'height':height,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'status':'ok'}
 except Exception as e:return {**a,'status':'failed','error':str(e)}
assets=[]
with ThreadPoolExecutor(max_workers=5) as pool:
 for future in as_completed([pool.submit(download,a) for a in jobs]):
  assets.append(future.result())
  if len(assets)%50==0:print('Downloaded',len(assets),'/',len(jobs),flush=True)
manifest={'collectedAt':'2026-10-26','kind':'Original game character illustrations via PRTS media library; unaltered 600px file-library previews; full original links retained.','assets':sorted(assets,key=lambda a:(a['charId'],a['stage'])),'missingTitles':missing}
(repo/'data/operator-art-sources.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'ok':sum(a['status']=='ok' for a in assets),'failed':[a for a in assets if a['status']!='ok'],'missing':missing,'bytes':sum(a.get('bytes',0) for a in assets)},ensure_ascii=False),flush=True)
