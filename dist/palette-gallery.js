(() => {
  const grid=document.querySelector('#palette-grid');
  for(const palette of window.TERRA_PALETTES){
    const card=document.createElement('article');card.className='palette-card';card.id=palette.id;
    card.style.setProperty('--canvas',palette.colors.canvas);card.style.setProperty('--accent',palette.colors.accent);
    const url='./?palette='+palette.id+'#yan';
    card.innerHTML='<div class="card-top"><div class="card-title"><span class="palette-code">'+palette.code+'</span><h2>'+palette.name+'</h2></div><div class="card-swatches" aria-label="主要颜色">'+['canvas','surface','muted','ink','accent'].map(k=>'<i style="background:'+palette.colors[k]+'"></i>').join('')+'</div></div>'+ 
      '<div class="preview-stage" aria-hidden="true" inert><iframe title="'+palette.code+' '+palette.name+'预览" src="./?palette='+palette.id+'&compare=1#yan" tabindex="-1" loading="eager"></iframe></div>'+ 
      '<div class="card-bottom"><p>'+palette.description+'</p><a class="try-link" href="'+url+'">体验 '+palette.code+' 版 <span aria-hidden="true">↗</span></a></div>';
    grid.append(card);
  }
  const resize=new ResizeObserver(entries=>{
    for(const entry of entries){const iframe=entry.target.querySelector('iframe');iframe.style.transform='scale('+entry.contentRect.width/1280+')';}
  });
  document.querySelectorAll('.preview-stage').forEach(stage=>resize.observe(stage));
})();
