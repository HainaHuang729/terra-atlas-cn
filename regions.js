/* Region identities and original insignia. All interaction geometry is generated
   exclusively from data/region-geometry.json; no coarse outline fallback is kept. */
window.TERRA_REGIONS={
  sami:{},
  ursus:{},
  higashi:{},
  yan:{},
  kazimierz:{},
  columbia:{},
  bolivar:{},
  kjerag:{},
  leithanien:{},
  kazdel:{},
  victoria:{},
  minos:{},
  siesta:{},
  siracusa:{},
  laterano:{},
  'rim-billiton':{},
  sargon:{},
  iberia:{}
};

// Visible alpha bounds keep differently shaped original insignia optically aligned.
const terraInsignia={"sami":{"anchor":[434,125],"insignia":"assets/insignia/sami.png","viewBox":[41,31,429,430]},"ursus":{"anchor":[800,166],"insignia":"assets/insignia/ursus.png","viewBox":[18,71,474,343]},"higashi":{"anchor":[989,156],"insignia":"assets/insignia/higashi.png","viewBox":[103,34,304,436]},"yan":{"anchor":[1003,257],"insignia":"assets/insignia/yan.png","viewBox":[59,25,393,452]},"kazimierz":{"anchor":[502,240],"insignia":"assets/insignia/kazimierz.png","viewBox":[117,27,272,466]},"columbia":{"anchor":[309,287],"insignia":"assets/insignia/columbia.png","viewBox":[27,36,452,436]},"bolivar":{"anchor":[202,293],"insignia":"assets/insignia/bolivar.png","viewBox":[18,18,472,474]},"kjerag":{"anchor":[490,329],"insignia":"assets/insignia/kjerag.png","viewBox":[54,49,404,404]},"leithanien":{"anchor":[644,321],"insignia":"assets/insignia/leithanien.png","viewBox":[22,62,471,378]},"kazdel":{"anchor":[862,309],"insignia":"assets/insignia/kazdel.svg","viewBox":[0,0,40,48],"imageSize":[40,48]},"victoria":{"anchor":[556,414],"insignia":"assets/insignia/victoria.png","viewBox":[23,59,466,366]},"minos":{"anchor":[382,449],"insignia":"assets/insignia/minos.png","viewBox":[38,51,436,412]},"siesta":{"anchor":[491,481],"insignia":"assets/insignia/siesta.png","viewBox":[34,58,443,383]},"siracusa":{"anchor":[768,396],"insignia":"assets/insignia/siracusa.png","viewBox":[55,30,401,434]},"laterano":{"anchor":[706,454],"insignia":"assets/insignia/laterano.png","viewBox":[23,48,466,440]},"rim-billiton":{"anchor":[839,458],"insignia":"assets/insignia/rim-billiton.png","viewBox":[26,159,459,183]},"sargon":{"anchor":[298,576],"insignia":"assets/insignia/sargon.png","viewBox":[20,81,473,387]},"iberia":{"anchor":[667,610],"insignia":"assets/insignia/iberia.png","viewBox":[17,109,476,293]}};
Object.entries(terraInsignia).forEach(([id,details])=>Object.assign(window.TERRA_REGIONS[id],details));
