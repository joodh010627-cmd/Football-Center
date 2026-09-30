  const mediaPhoto=root.querySelector('.stadium-story img')?.src||'';
  const journalPhoto=root.querySelector('.photo-feature img')?.src||mediaPhoto;
  const brandMedia=window.FCBrandMedia||[];
  const upcomingNews=()=>events.filter(e=>e.date>='2026-09-18').sort((a,b)=>a.date.localeCompare(b.date));
  function newsCard(e,feature=false){return btn('club-news-detail',(feature&&journalPhoto?h('img',{src:journalPhoto,alt:'축구 훈련에서 공을 다루는 선수의 발',loading:'lazy'}):'')+div('news-caption',h('span',{class:'news-meta'},dateLabel(e.date)+' · '+eventKinds.find(k=>k[0]===e.kind)[1]+' · 일정 연동')+h('strong',{},esc(e.title))+p(e.target+' · '+(e.place||'장소 별도 안내'))+h('span',{class:'text-link'},'소식과 참가 안내 보기 →')),e.id,'club-news-card'+(feature?' featured':''));}
  function clubBrandTile(id){const a=brandMedia[id];if(!a)return '';return btn('club-brand',h('div',{class:'brand-visual'},h('img',{src:a.image,alt:a.alt,loading:'lazy'}))+div('brand-copy',h('span',{class:'brand-label'},'광고 목업 · 제휴 아님')+h('strong',{},id===2?'다음 플레이를<br>준비하는 방식.':'같이 뛰고,<br>같이 즐기고.')+h('span',{},id===2?'NIKE FOOTBALL →':'KFC · AFTER THE MATCH →')),String(id),'club-brand-tile '+(id===2?'dark':'light'));}
  function clubHomeExtras(){const next=upcomingNews()[0];return h('div',{class:'club-extra'},
    btn('library-home',div('library-icon','≡')+div('copy',h('strong',{},'우리 클럽 훈련 블록')+h('small',{},'5개 역량 · 공용 블록 '+blocks.length+'개'))+h('span',{},'›'),'','library-entry')+
    div('section-heading',h('h2',{},'클럽 소식')+btn('club-news','전체 보기 →','','text-link'))+
    (next?newsCard(next,true):p('새 일정을 추가하면 클럽 소식에 함께 보여요.'))+
    div('section-heading',h('div',{},h('span',{class:'eyebrow'},'FC GROWTH PICKS')+h('h2',{},'축구를 즐기는 또 다른 방식')))+
    div('club-brand-rail',clubBrandTile(2)+clubBrandTile(1))+
    p('가상 클럽 소식과 광고 시안입니다. 실제 브랜드 제휴·혜택이 아닙니다.','demo-note'));
  }
  function clubNewsPage(){return title('CLUB NEWS','우리 클럽 이야기','일정과 참가 안내를 함께 확인하세요.')+upcomingNews().map(e=>newsCard(e)).join('')+btn('schedule-home','월간 일정 보기','','secondary wide');}
  function clubNewsDetail(){const e=getEvent(route.args.id);return title('CLUB STORY',e.title,dateLabel(e.date)+' · '+eventKinds.find(k=>k[0]===e.kind)[1])+
    (journalPhoto?h('img',{class:'story-image',src:journalPhoto,alt:'축구 훈련 장면'}):'')+sec('함께 뛰는 하루',p(e.note||e.title+' 일정을 안내합니다.',''))+
    facts([['일정',e.date.replaceAll('-','.')+' · '+(e.kind==='break'?'종일':e.time)],['대상',e.target],['장소',e.place||'별도 안내']])+
    btn('event-detail','연결된 일정 보기',e.id,'primary wide')+(e.form?btn('event-form','참가 안내 폼 보기',e.id,'secondary wide'):'')+p('일정 정보를 바탕으로 구성한 클럽 소식 예시입니다.','demo-note');}
  function clubBrandPage(){const a=brandMedia[Number(route.args.id)];return title('PARTNER STORY',a.brand.split(' · ')[0],'광고 목업 · 실제 제휴 아님')+h('img',{class:'story-image',src:a.image,alt:a.alt})+sec(a.title.replaceAll('<br>',' '),p(a.copy.replaceAll('<br>',' '),''))+p(a.detail,'demo-note')+btn('support-hub','우리 일정에 맞는 협찬 찾기','','primary wide');}
