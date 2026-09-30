  function startPlan(id='class-3'){planDraft=JSON.parse(JSON.stringify(planFor(id)));launch('plan',{id},'class');}
  function planPage(){
    const c=api.getClass(planDraft.classId),total=totalMinutes(planDraft);
    return title('SESSION BUILDER','블록으로 수업 구성',c.name+' · '+c.time+' · '+api.getCoach(c.coachId).name+' 코치')+
      field('오늘의 목표','planGoal',planDraft.goal,'text','maxlength="100"')+
      div('section-heading',h('h2',{},'훈련 순서')+tag(planDraft.blockIds.length+'개 · '+total+'분'))+
      div('plan-sequence',planBlocks(planDraft).map((b,i)=>div('plan-block',div('sequence-number',String(i+1).padStart(2,'0'))+div('sequence-body',btn('plan-block',h('strong',{},esc(b.title))+p(b.goal),b.id,'sequence-open')+div('block-meta',tag(getArea(b.area).name)+h('span',{},blockMinutes(planDraft,b)+'분'))+h('details',{class:'block-controls'},h('summary',{},'순서·시간 조정')+field('진행 시간 · 분','duration-'+b.id,blockMinutes(planDraft,b),'number','min="3" max="60"')+div('sequence-actions',btn('block-up','↑ 위로',b.id)+btn('block-down','↓ 아래로',b.id)+btn('block-remove','삭제',b.id)))))).join('')||div('empty','아래에서 첫 훈련 블록을 골라주세요.'))+
      btn('block-library','+ 기본 블록에서 고르기','','secondary wide')+
      h('details',{},h('summary',{},'수업 메모 추가 · 선택')+areaField('코칭 포인트','planNote',planDraft.note,'이번 수업에 덧붙일 한 가지'))+
      (total!==60?p('정기 수업은 60분입니다. 현재 구성은 '+total+'분이에요.','duration-note'):'')+
      error()+btn('save-plan','수업에 적용','','primary wide')+demo();
  }
  function planDone(){const pl=planFor(route.args.id),c=api.getClass(pl.classId);return title('READY TO COACH',route.args.saved?'수업 준비가 끝났어요':c.name,c.time+' · '+api.getCoach(c.coachId).name+' 코치')+surface('TODAY’S GOAL',pl.goal,pl.blockIds.length+'개 블록 · '+totalMinutes(pl)+'분')+
    sec('오늘의 흐름',planBlocks(pl).map((b,i)=>btn('plan-block-view',h('span',{class:'sequence-number'},String(i+1).padStart(2,'0'))+div('copy',h('strong',{},esc(b.title))+h('small',{},getArea(b.area).name+' · '+blockMinutes(pl,b)+'분'))+h('span',{},'›'),b.id,'data-row')).join(''))+
    btn('record','수업 마무리 · 빠른 기록',c.id,'primary wide')+btn('plan','구성 수정',c.id,'secondary wide')+btn('class-info','클래스 정보 더 보기',c.id,'text-link wide')+demo();}
  function startRecord(id){const c=api.getClass(id),sid=c.id+'-2026-09-18',existing=api.getSession(sid),pl=planFor(id);recordDraft={classId:id,sessionId:sid,players:{},absent:existing?.absent.slice()||[],note:existing?.coachNote||'',picker:false,drills:existing?.trainingBlocks?existing.trainingBlocks.map(b=>b.id).filter(id=>pl.blockIds.includes(id)):pl.blockIds.slice()};api.observations.filter(o=>o.sessionId===sid&&o.beyond).forEach(o=>{recordDraft.players[o.playerId]={area:areas.find(a=>a.name===o.area).id,state:o.state};});launch('record',{id},'class');}
  const recordFocus=(pl,id)=>focusFor({...pl,blockIds:recordDraft.drills},id);
  function recordPage(){
    const c=api.getClass(recordDraft.classId),pl=planFor(c.id),roster=api.roster(c),selections=Object.entries(recordDraft.players);
    return title('SESSION COMPLETE','수업 마무리',c.name+' · 9.18 '+c.time)+surface('TODAY’S GOAL',pl.goal,pl.blockIds.length+'개 훈련 블록 · '+totalMinutes(pl)+'분')+
      h('details',{},h('summary',{},'진행한 훈련 '+recordDraft.drills.length+' / '+pl.blockIds.length+'개 · 확인')+planBlocks(pl).map(b=>check(b.title+' · '+blockMinutes(pl,b)+'분','drill',b.id,recordDraft.drills.includes(b.id))).join(''))+
      h('details',{},h('summary',{},'출석 '+(roster.length-recordDraft.absent.length)+' / '+roster.length+'명 · 변경')+roster.map(p=>check(p.name,'attendance',p.id,!recordDraft.absent.includes(p.id))).join(''))+
      sec('눈에 띈 선수만',p('오늘의 한 장면을 남겨주세요.')+selections.map(([id,v])=>{const person=api.getPlayer(id),a=recordFocus(pl,v.area);return div('edu-surface quick-player',div('headerline',h('h3',{},esc(person.name))+btn('remove-player','삭제',id))+choices('record-area-'+id,areas.map(a=>[a.id,a.name]),v.area)+p(a.sub+' · '+a.behavior)+choices('record-state-'+id,[['good','✓ 좋음'],['growing','↗ 성장'],['follow','! 다음 확인']],v.state));}).join('')+
        btn('picker',recordDraft.picker?'선수 선택 닫기':'+ 선수 선택','','secondary wide')+(recordDraft.picker?div('player-picker',roster.filter(p=>!recordDraft.players[p.id]&&!recordDraft.absent.includes(p.id)).map(p=>row('add-player',p.id,p.name,p.age)).join('')||p('모든 출석 선수를 선택했어요.')):''))+
      h('details',{},h('summary',{},'메모 추가 · 선택')+areaField('수업 메모','recordNote',recordDraft.note,'필요한 장면만 짧게 남겨주세요'))+
      error()+btn('save-record','수업 완료','','primary wide')+p('기본값은 전원 출석·모든 블록 진행입니다. 변경한 내용만 수정하면 됩니다.','demo-note')+demo();
  }
  function saveRecord(){
    const picks=Object.entries(recordDraft.players);
    if(picks.some(([id,v])=>!v.state)){notice('선택한 선수의 상태를 골라주세요. 관찰하지 않았다면 삭제할 수 있어요.');return;}
    const c=api.getClass(recordDraft.classId),pl=planFor(c.id);
    let s=api.getSession(recordDraft.sessionId);
    if(!s){s={id:recordDraft.sessionId,classId:c.id,coachId:c.coachId,date:'2026-09-18',time:c.time,templateId:c.templateId};api.sessions.unshift(s);}
    Object.assign(s,{goal:pl.goal,status:'complete',absent:recordDraft.absent.slice(),completedDrills:recordDraft.drills.map(id=>getBlock(id).title),trainingBlocks:recordDraft.drills.map(id=>({...getBlock(id),minutes:blockMinutes(pl,getBlock(id))})),coachNote:recordDraft.note});
    for(let i=api.observations.length-1;i>=0;i--)if(api.observations[i].sessionId===s.id&&api.observations[i].beyond)api.observations.splice(i,1);
    picks.forEach(([id,v])=>{const a=recordFocus(pl,v.area),b=recordDraft.drills.map(getBlock).find(b=>b.area===v.area);api.observations.push({playerId:id,sessionId:s.id,blockId:b?.id||null,area:a.name,tag:a.sub,state:v.state,note:a.behavior+' — '+({good:'좋은 장면이 관찰됐어요.',growing:'이전보다 발전한 장면이 관찰됐어요.',follow:'다음 수업에서 다시 확인할 장면이에요.'})[v.state],beyond:true});});
    const today=['class-1','class-2','class-3','class-4'].map(id=>api.getSession(id+'-2026-09-18')?.status||'planned');
    root.querySelector('#fc-summary').textContent='전체 4 · 완료 '+today.filter(x=>x==='complete').length+' · 예정 '+today.filter(x=>x==='planned').length+' · 기록 필요 '+today.filter(x=>x==='record').length;
    if(c.id==='class-2'){root.querySelector('#fc-record-status').textContent='완료';root.querySelector('#fc-record-status').classList.remove('amber');root.querySelector('#fc-reminder').hidden=true;}
    if(c.id==='class-3'){root.querySelector('.hero .kicker').textContent='CLASS COMPLETE';root.querySelector('.hero .bottom .small').textContent='기록 완료';}
    route={view:'recordDone',args:{id:c.id,sessionId:s.id,picks:picks.map(([id])=>id)},tab:'class'};stack=[];render();
  }
  function recordDone(){const c=api.getClass(route.args.id);return title('RECORDED','수업이 성장 기록으로',c.name+' · 완료')+surface('LINKED TO SESSION','기록을 연결했어요','진행한 훈련과 출석, 선택한 선수의 관찰을 함께 저장했습니다.')+sec('관찰한 선수',route.args.picks.length?route.args.picks.map(id=>row('player-info',id,api.getPlayer(id).name,'성장 기록 확인')).join(''):p('참여 선수에게 수업 이력이 연결됐어요.'))+btn('session-info','수업 기록 더 보기',route.args.sessionId,'primary wide')+btn('nav-class','오늘의 클래스로','','secondary wide')+demo();}
  function augmentClub(detail){
    const el=root.querySelector('#fc-club-screen');el.querySelectorAll('.edu-bridge,.club-extra').forEach(x=>x.remove());
    if(detail.view==='home'){el.insertAdjacentHTML('beforeend',clubHomeExtras());return;}
    if(detail.view==='class'){
      const c=api.getClass(detail.id),pl=planFor(c.id),old=el.querySelector('.club-highlight');
      if(old)old.outerHTML=h('div',{class:'edu-bridge'},h('span',{class:'club-eyebrow'},'TODAY’S PLAN')+h('h2',{},esc(pl.goal))+p(pl.blockIds.length+'개 훈련 블록 · '+totalMinutes(pl)+'분')+div('headerline',btn('plan-preview','수업 구성 보기 →',c.id)+btn('record','수업 마무리',c.id)));
    }
  }
