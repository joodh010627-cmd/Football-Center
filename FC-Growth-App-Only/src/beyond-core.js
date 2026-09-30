(() => {
  'use strict';
  const api=window.FCClub, root=document.getElementById('fc-live'), screen=root.querySelector('#fc-beyond'), scroller=root.querySelector('.app-scroll');
  const share=/*FC_SHARE_CONTEXT*/null;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const h=(tag,attrs,body='')=>'<'+tag+Object.entries(attrs||{}).map(([k,v])=>' '+k+'="'+esc(v)+'"').join('')+'>'+body+'</'+tag+'>';
  const div=(c,b)=>h('div',{class:c},b), p=(t,c='muted')=>h('p',{class:c},esc(t));
  const btn=(act,text,id='',c='')=>h('button',{'data-act':act,'data-id':id,class:c,type:'button',...(['month-prev','month-next'].includes(act)?{'aria-label':act==='month-prev'?'이전 달':'다음 달'}:{})},text);
  const tag=(text,c='')=>h('span',{class:'tag '+c},esc(text));
  const sec=(title,body)=>h('section',{},h('h2',{},esc(title))+body);
  const demo=()=>p('체험용 데이터 · 새로고침 시 초기화됩니다.','demo-note');
  const field=(label,name,value,type='text',extra='')=>h('label',{class:'field'},esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'>');
  const areaField=(label,name,value,placeholder='')=>h('label',{class:'field'},esc(label)+h('textarea',{name,rows:'2',placeholder},esc(value)));
  const select=(label,name,options,value)=>h('label',{class:'field'},esc(label)+h('select',{name},options.map(([id,t])=>'<option value="'+esc(id)+'"'+(id===value?' selected':'')+'>'+esc(t)+'</option>').join('')));
  const check=(label,name,id,yes)=>h('label',{class:'checkline'},'<input type="checkbox" name="'+name+'" value="'+esc(id)+'"'+(yes?' checked':'')+'>'+esc(label));
  const row=(act,id,title,sub,badge='',lead='')=>btn(act,(lead?div('number',lead):'')+div('copy',h('strong',{},esc(title))+h('small',{},esc(sub))+(badge?tag(badge):''))+h('span',{'aria-hidden':'true'},'›'),id,'data-row');
  const facts=items=>div('facts',items.map(([l,v])=>h('div',{},h('span',{},esc(l))+h('strong',{},esc(v)))).join(''));
  const choices=(act,items,selected)=>div('pillset',items.map(([id,label])=>h('button',{'data-act':act,'data-id':id,'aria-pressed':String(Array.isArray(selected)?selected.includes(id):id===selected),type:'button'},esc(label))).join(''));
  const title=(en,text,sub='')=>(stack.length?btn('back','← 뒤로','','back'):'')+h('span',{class:'eyebrow'},en)+h('h1',{tabindex:'-1'},esc(text))+(sub?p(sub):'');
  const error=()=>'<p id="b-error" class="error" role="status"></p>';
  const notice=t=>{const el=screen.querySelector('#b-error');if(el)el.textContent=t;};
  const surface=(en,t,sub)=>div('edu-surface',h('span',{class:'eyebrow'},en)+h('h2',{},esc(t))+p(sub));
  const iso=d=>d.toISOString().slice(0,10), dateLabel=d=>Number(d.slice(5,7))+'.'+Number(d.slice(8,10));
  const areas=[
    {id:'technical',name:'기술',sub:'패스',behavior:'동료가 받기 좋은 곳으로 패스',drill:'2인 패스 · 눈을 맞추고 전달',meaning:'서로의 준비를 살피며 협력하는 경험'},
    {id:'tactical',name:'전술',sub:'공간 인식',behavior:'패스 후 빈 공간으로 이동',drill:'3대1 론도 · 공이 없을 때 지원',meaning:'팀 안에서 자신의 역할을 찾는 경험'},
    {id:'physical',name:'피지컬',sub:'밸런스',behavior:'균형을 유지하며 방향 전환',drill:'콘 드리블 · 멈춤과 방향 전환',meaning:'자기 몸의 움직임과 컨디션을 알아가는 경험'},
    {id:'mental',name:'멘탈',sub:'회복력',behavior:'실수 후 다음 플레이에 다시 참여',drill:'미니게임 · 실수 뒤 바로 재도전',meaning:'결과와 관계없이 끝까지 도전하는 위닝 멘탈리티'},
    {id:'attitude',name:'태도',sub:'소통',behavior:'동료를 부르고 패스 요청',drill:'이름 부르며 패스 · 역할 교대',meaning:'의사를 표현하고 동료의 말을 듣는 공동체 경험'}
  ];
  const getArea=id=>areas.find(a=>a.id===id);
  function focusFor(pl,id){const a={...getArea(id)},b=planBlocks(pl).find(b=>b.area===id);if(b)Object.assign(a,{sub:b.skill,drill:b.title,behavior:b.observe});return a;}
  const plans=new Map();
  function planFor(id){if(!plans.has(id)){const c=api.getClass(id);plans.set(id,syncPlan({classId:id,goal:c.goal,blockIds:['physical-1','technical-1','tactical-1','attitude-1'],durations:{},note:''}));}return plans.get(id);}
  let planDraft=null, recordDraft=null, formDraft=null, eventDraft=null, blockDraft=null, activeStage='invite', activeMonth='2026-09', activeDay='2026-09-18', activeCategories=['class','match','event','camp','break'], blockFilter='all', responseFilter='all', route=null,stack=[],linkedConfig=null,rating=0;
  const events=[
    {id:'evt-family',kind:'event',title:'패밀리 풋볼 데이',date:'2026-09-19',time:'10:00',place:'A구장',target:'전 원생·학부모',form:'parents',note:'부모님과 함께 패스 미션, 역할 교대, 미니게임'},
    {id:'evt-match',kind:'match',title:'U10 교류 대회',date:'2026-09-20',time:'09:00',place:'서초 풋볼 파크',target:'U10',form:'program',note:'경기 중 패스 선택과 실수 후 재도전을 관찰합니다.'},
    {id:'evt-camp',kind:'camp',title:'가을 팀 캠프',date:'2026-09-26',time:'10:00',place:'가상 스포츠 캠프',target:'U10·U12',form:'camp',note:'기본기 훈련과 팀 활동을 함께하는 하루'}
  ];
  const applications=[];
  function currentTab(){return root.querySelector('.nav [aria-current="page"]')?.dataset.tab||'class';}
  function launch(view,args={},tab=currentTab()){stack=[{view:'return',tab:currentTab(),club:api.current()}];route={view,args,tab};render();}
  function go(view,args={},tab=route?.tab||currentTab()){if(route)stack.push({...route,scroll:scroller.scrollTop});else stack.push({view:'return',tab:currentTab(),club:api.current()});route={view,args,tab};render();}
  function back(){const last=stack.pop();if(!last||last.view==='return'){const tab=last?.tab||route.tab;route=null;root.querySelector('.nav [data-tab="'+tab+'"]').click();if(tab==='club'&&last?.club)api.resume(last.club);return;}route=last;render();scroller.scrollTo({top:last.scroll||0,behavior:'instant'});}
  function render(focus=true){root.querySelectorAll('[data-view]').forEach(v=>v.hidden=v.dataset.view!=='beyond');root.querySelectorAll('.nav [data-tab]').forEach(b=>{const on=b.dataset.tab===route.tab;b.classList.toggle('active',on);if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});screen.innerHTML=views[route.view]();scroller.scrollTo({top:0,behavior:'instant'});if(focus)screen.querySelector('h1')?.focus({preventScroll:true});}
  function openClub(view,id){route=null;root.querySelector('.nav [data-tab="club"]').click();api.show(view,id);}
