(() => {
  const palette=window.TERRA_PALETTES?.find(p=>p.id===document.documentElement.dataset.palette);
  if(!palette||!document.documentElement.dataset.palettePreview)return;
  const link=document.createElement('a');
  link.className='palette-return';
  link.href='palettes.html#'+palette.id;
  link.title='返回四版配色对照';
  link.innerHTML='<b>'+palette.code+'</b><span>'+palette.name+'</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 5-5 5 5 5M3 10h10a4 4 0 0 0 0-8"/></svg>';
  document.querySelector('.header-end').prepend(link);
  document.title=palette.code+' · '+palette.name+' — 泰拉观测站配色预览';
  document.querySelector('meta[name="theme-color"]').content=palette.colors.canvas;
})();
