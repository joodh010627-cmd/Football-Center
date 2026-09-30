(() => {
  'use strict';
  const root=document.getElementById('fc-live'), screen=root.querySelector('#fc-club-screen'), scroll=root.querySelector('.app-scroll');
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const h=(tag,attrs,body='')=>'<'+tag+Object.entries(attrs||{}).map(([k,v])=>' '+k+'="'+esc(v)+'"').join('')+'>'+body+'</'+tag+'>';
  const div=(cls,body)=>h('div',{class:cls},body);
  const p=(text,cls='club-muted')=>h('p',{class:cls},esc(text));
  const icon=n=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({right:'<path d="m9 18 6-6-6-6"/>',back:'<path d="m12 19-7-7 7-7M5 12h14"/>',search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'})[n]+'</svg>';
  const coaches=[
    ['김민준','교육 리드','상황을 질문으로 풀어내는 코칭','압박 상황에서 선택할 시간을 충분히 주기'],
    ['이도현','U10 담당 코치','짧은 패스와 퍼스트터치 지도','터치 이후의 움직임까지 연결해 관찰하기'],
    ['박지훈','입문 과정 코치','놀이를 통해 참여를 이끄는 수업','공을 만지는 횟수가 고르게 분배되는지 보기'],
    ['정서연','성장 과정 코치','단계별 미션과 명확한 시범','선수마다 다음 도전 과제를 하나씩 제안하기'],
    ['최태윤','팀 플레이 코치','동료와 연결되는 움직임 지도','공이 없을 때의 선택을 함께 관찰하기'],
    ['한승우','퍼포먼스 코치','균형과 방향 전환 움직임 지도','속도보다 정확한 움직임을 먼저 확인하기']
  ].map((v,i)=>({id:'coach-'+(i+1),name:v[0],role:v[1],strength:v[2],focus:v[3]}));
  const classes=[
    ['U8 플레이','U8','입문',8,2,'14:00','화·금','A구장','공과 친해지기','볼 감각'],
    ['U10 베이직','U10','기초',12,0,'16:00','화·금','A구장','패스 후 공간 이동','패스 & 움직임'],
    ['U10 베이직','U10','기초',12,1,'18:00','화·금','A구장','패스 후 공간 이동','패스 & 움직임'],
    ['U12 어드밴스','U12','심화',14,0,'19:00','화·금','B구장','압박 속 빠른 패스 선택','압박 대응'],
    ['U8 퍼스트킥','U8','입문',6,2,'15:00','월·목','A구장','양발로 공 멈추기','볼 감각'],
    ['U10 볼 마스터리','U10','기초',6,3,'17:00','월·목','A구장','방향을 바꾸며 공 지키기','볼 컨트롤'],
    ['U10 플레이메이커','U10','성장',5,4,'18:00','월·목','B구장','패스 길을 만드는 움직임','공간 인식'],
    ['U12 팀 플레이','U12','성장',5,1,'19:00','월·목','B구장','동료를 보며 패스 연결','협력 & 소통'],
    ['U12 게임 인텔리전스','U12','심화',5,4,'18:00','수·토','A구장','받기 전 주변 확인','판단 & 시야'],
    ['U8 무브먼트','U8','입문',5,5,'10:00','수·토','A구장','멈추고 방향 바꾸기','기초 움직임'],
    ['U10 챌린지','U10','성장',4,3,'16:00','수·토','B구장','실수 후 다시 도전하기','도전 & 회복'],
    ['U12 퍼포먼스','U12','성장',4,5,'17:00','수·토','B구장','균형을 유지하며 속도 바꾸기','신체 조절']
  ].map((v,i)=>({id:'class-'+(i+1),name:v[0],age:v[1],level:v[2],size:v[3],coachId:coaches[v[4]].id,time:v[5],days:v[6],venue:v[7],goal:v[8],curriculum:v[9],templateId:'TPL-'+String(i+1).padStart(2,'0')}));
  const family=['김','이','박','최','정','강','조','윤','장','임'], given=['도윤','서준','지호','하준','지우','서진','시우','예준','수빈','건우'];
  const names=family.flatMap(f=>given.map(g=>f+g)), featured=['김민수','이준호','박현우'];
  let serial=0;
  const players=classes.flatMap(c=>Array.from({length:c.size},(_,i)=>{const n=serial++;return {id:'player-'+(n+1),name:c.id==='class-3'&&i<3?featured[i]:names[n],classId:c.id,age:c.age,joined:'2026-'+(['03','05','07'][n%3])+'-02',number:n};}));
  const getClass=id=>classes.find(c=>c.id===id), getCoach=id=>coaches.find(c=>c.id===id), getPlayer=id=>players.find(p=>p.id===id);
  const roster=c=>players.filter(p=>p.classId===c.id);
  const snapshot='2026-09-18', period='8.22–9.18 · 최근 4주', iso=d=>d.toISOString().slice(0,10);
  const weekdays=c=>({'화·금':[2,5],'월·목':[1,4],'수·토':[3,6]})[c.days];
  const sessions=classes.flatMap(c=>{
    const out=[],day=new Date(snapshot+'T12:00:00Z');
    while(out.length<8){const date=iso(day);if(weekdays(c).includes(day.getUTCDay())&&(date<snapshot||c.time<'17:30')){
      out.push({id:c.id+'-'+date,classId:c.id,coachId:c.coachId,date,time:c.time,goal:c.goal,templateId:c.templateId,status:date===snapshot&&c.id==='class-2'?'record':'complete',absent:roster(c).filter(p=>!featured.includes(p.name)&&p.number%7===0&&out.length===2).map(p=>p.id)});
    }day.setUTCDate(day.getUTCDate()-1);}return out;
  });
  const classSessions=c=>sessions.filter(s=>s.classId===c.id), getSession=id=>sessions.find(s=>s.id===id), inPeriod=s=>s.date>='2026-08-22'&&s.date<=snapshot;
  const minsu=players.find(p=>p.name==='김민수'), junho=players.find(p=>p.name==='이준호'), hyunwoo=players.find(p=>p.name==='박현우'), observed=classSessions(getClass(minsu.classId));
  const observations=[
    [minsu.id,0,'기술','퍼스트터치','growing','패스를 받기 전에 주변을 보고, 다음 움직임을 향해 첫 터치를 연결했어요.'],
    [minsu.id,2,'기술','퍼스트터치','good','공을 멈춘 뒤 패스까지 이어가는 움직임이 부드러웠어요.'],
    [junho.id,0,'멘탈','도전성','growing','실수한 뒤에도 다시 공을 달라고 요청하며 도전을 이어갔어요.'],
    [junho.id,3,'멘탈','자신감','good','미니게임에서 스스로 패스를 선택하고 적극적으로 참여했어요.'],
    [hyunwoo.id,0,'전술','압박 대응','follow','수비가 가까워지면 패스 선택이 늦어져요. 공을 받기 전 시야 확인을 함께 볼 예정이에요.'],
    [hyunwoo.id,1,'전술','판단','follow','압박을 받는 상황에서 패스할 동료를 찾는 시간이 필요했어요.']
  ].map(v=>({playerId:v[0],sessionId:observed[v[1]].id,area:v[2],tag:v[3],state:v[4],note:v[5]}));
  const areas=[['기술','TECHNICAL'],['전술','TACTICAL'],['피지컬','PHYSICAL'],['멘탈','MENTAL'],['태도','ATTITUDE']];
  const notesFor=p=>observations.filter(o=>o.playerId===p.id), followPlayers=players.filter(p=>notesFor(p).some(o=>o.state==='follow'));
  const statsFor=p=>{const recorded=sessions.filter(s=>s.classId===p.classId&&inPeriod(s)&&s.status==='complete'),attended=recorded.filter(s=>!s.absent.includes(p.id));return {recorded,attended,rate:recorded.length?Math.round(attended.length/recorded.length*100):null};};
  const dateText=d=>Number(d.slice(5,7))+'.'+Number(d.slice(8,10)), endTime=c=>String(Number(c.time.slice(0,2))+1).padStart(2,'0')+':00';
  const nextSession=c=>{const d=new Date(snapshot+'T12:00:00Z');while(!weekdays(c).includes(d.getUTCDay())||(iso(d)===snapshot&&c.time<'17:30'))d.setUTCDate(d.getUTCDate()+1);return dateText(iso(d))+' · '+c.time+'–'+endTime(c);};
  let route={view:'home',query:'',filter:'전체'}, stack=[];
  const routeButton=(view,id,label,cls='')=>h('button',{'data-club-route':view,'data-id':id||'',class:cls},label);
  const avatar=(name,coach=false,large=false)=>h('span',{class:'club-avatar'+(coach?' coach':'')+(large?' large':''),'aria-hidden':'true'},esc(name.slice(1)));
  const back=()=>h('button',{'data-club-back':'',class:'club-back'},icon('back')+h('span',{},({home:'클럽',players:'원생',coaches:'코치',classes:'클래스',player:'원생 상세',coach:'코치 상세',class:'클래스 상세',session:'수업 기록'})[stack.length?stack[stack.length-1].view:'home']));
  const eyebrow=t=>h('span',{class:'club-eyebrow'},esc(t));
  const title=t=>h('h1',{tabindex:'-1'},esc(t));
  const heading=(en,t,sub='')=>(route.view!=='home'?back():'')+eyebrow(en)+title(t)+(sub?p(sub):'');
  const demo=()=>h('span',{class:'club-demo'},'DEMO · 9월 18일 기준 가상 데이터');
  const section=(t,body,action='')=>h('section',{class:'club-section'},div('club-section-head',h('h2',{},esc(t))+action)+body);
  const facts=items=>h('dl',{class:'club-facts'},items.map(([a,b])=>h('div',{},h('dt',{},esc(a))+h('dd',{},b))).join(''));
  const metric=(label,value)=>div('club-metric',h('span',{class:'metric-label'},esc(label))+h('strong',{},value));
  const highlight=(en,t,text,button='',follow=false)=>div('club-highlight'+(follow?' follow':''),eyebrow(en)+h('h2',{},esc(t))+p(text)+button);
  const row=(view,id,t,sub,lead='',tag='',needs=false)=>routeButton(view,id,lead+h('span',{class:'row-copy'},h('strong',{},esc(t))+h('span',{class:'row-sub'},esc(sub))+(tag?h('span',{class:'row-tag'+(needs?' needs':'')},esc(tag)):''))+icon('right'),'club-row');
  const playerRow=p=>{const c=getClass(p.classId),n=notesFor(p),f=n.filter(o=>o.state==='follow');return row('player',p.id,p.name,p.age+' · '+c.name+' · '+c.time,avatar(p.name),f.length?'확인 필요 · '+f[0].tag:n.length?'최근 관찰 · '+n[0].tag:'',!!f.length);};
  const classRow=c=>row('class',c.id,c.name,c.days+' '+c.time+' · '+getCoach(c.coachId).name+' 코치','',c.level+' · 원생 '+roster(c).length+'명');
  const coachRow=c=>{const assigned=classes.filter(x=>x.coachId===c.id);return row('coach',c.id,c.name+' 코치',c.role,avatar(c.name,true),'담당 클래스 '+assigned.length+'개 · 원생 '+players.filter(p=>assigned.some(x=>x.id===p.classId)).length+'명');};
  const sessionRow=(s,player=null)=>{const c=getClass(s.classId),status=s.status==='record'?'기록 필요':player&&s.absent.includes(player.id)?'결석':'수업 완료';return row('session',s.id,c.name,s.time+' · '+s.goal,h('span',{class:'club-session-date'},Number(s.date.slice(5,7))+'월'+h('strong',{},String(Number(s.date.slice(8,10))))),status,status==='기록 필요');};
  const noteRow=o=>{const s=getSession(o.sessionId);return h('article',{class:'club-note'},h('span',{class:'club-muted'},dateText(s.date)+' · '+o.area+' / '+o.tag)+p(o.note,'')+routeButton('session',s.id,getCoach(s.coachId).name+' 코치 · 수업 기록 보기 →'));};
  const disclosure=(label,body)=>h('details',{class:'club-disclosure'},h('summary',{},esc(label))+body);
  function home(){
    const pending=sessions.filter(s=>s.status==='record'),follow=players.filter(p=>notesFor(p).some(o=>o.state==='follow'));
    return heading('OUR CLUB','서초 그린 유나이티드')+demo()+
      div('club-metrics',[['players','원생',players.length],['coaches','코치',coaches.length],['classes','클래스',classes.length]].map(([v,l,n])=>h('button',{'data-club-route':v,class:'club-metric','aria-label':l+' '+n+' 목록 보기'},h('span',{class:'metric-label'},l+icon('right'))+h('strong',{},String(n)))).join(''))+
      section('오늘 확인할 일',
        (pending.length?row('session',pending[0].id,'기록이 필요한 수업 '+pending.length+'개','완료 기록을 연결해 주세요.'):p('수업 기록이 모두 연결되어 있어요.'))+
        (follow.length?row('player',follow[0].id,'다음 수업에서 확인할 선수 '+follow.length+'명',follow[0].name+' · '+notesFor(follow[0]).find(o=>o.state==='follow').tag):''));
  }
  function filteredItems(){
    if(route.view==='players')return players.filter(p=>(!route.classId||p.classId===route.classId)&&(route.filter==='전체'||p.age===route.filter||route.filter==='확인 필요'&&notesFor(p).some(o=>o.state==='follow'))&&(p.name+' '+getClass(p.classId).name).includes(route.query.trim()));
    if(route.view==='classes')return classes.filter(c=>(route.filter==='전체'||c.age===route.filter)&&(c.name+' '+getCoach(c.coachId).name).includes(route.query.trim()));
    return coaches;
  }
  const resultCount=()=>filteredItems().length+(route.view==='classes'?'개 클래스':'명');
  function listRows(){
    const v=filteredItems();
    return v.length?v.map(route.view==='players'?playerRow:route.view==='coaches'?coachRow:classRow).join(''):div('club-empty',h('h3',{},'일치하는 항목이 없어요')+p('이름이나 선택한 조건을 확인해 주세요.')+h('button',{'data-club-reset':''},'전체 다시 보기'));
  }
  function listing(){
    const m={players:['PLAYERS','원생','선수마다 쌓이는 수업과 성장 기록'],coaches:['COACHES','코치','담당 수업과 코칭의 강점을 함께 봅니다'],classes:['CLASSES','클럽 클래스','정기 클래스와 실제 수업 기록']}[route.view];
    const filters=route.view==='players'?['전체','U8','U10','U12','확인 필요']:['전체','U8','U10','U12'];
    const search=route.view==='coaches'?'':h('label',{class:'club-search'},icon('search')+'<input type="search" id="fc-club-search" autocomplete="off" placeholder="'+(route.view==='players'?'이름 또는 클래스 검색':'클래스 또는 코치 검색')+'" aria-label="'+m[1]+' 검색" value="'+esc(route.query)+'">')+
      h('div',{class:'club-filters','aria-label':m[1]+' 필터'},filters.map(f=>h('button',{'data-club-filter':f,'aria-pressed':String(route.filter===f)},f)).join(''));
    return heading(m[0],m[1],route.classId?getClass(route.classId).name+' · '+getClass(route.classId).time+' 소속':m[2])+search+h('p',{class:'club-results',id:'fc-club-result-count',role:'status'},resultCount())+h('div',{id:'fc-club-results'},listRows())+demo();
  }
  function playerPage(){
    const person=getPlayer(route.id),c=getClass(person.classId),coach=getCoach(c.coachId),stats=statsFor(person),notes=notesFor(person),follow=notes.filter(o=>o.state==='follow'),positive=notes.filter(o=>o.state!=='follow');
    const focus=follow.length?'공을 받기 전, 주변 확인':positive.length&&person.id===minsu.id?'첫 터치 후, 패스와 이동 연결':positive.length?'새로운 상황에서도 자신 있게 시도하기':'다음 수업에서 첫 관찰 남기기';
    const growth=areas.map(([area,en])=>{const found=notes.filter(o=>o.area===area),f=found.some(o=>o.state==='follow');return div('club-growth-row',h('div',{},h('strong',{},area)+h('small',{},en))+h('span',{class:'club-state '+(found.length?(f?'needs':'positive'):'')},found.length?(f?'! 확인 필요':'↗ 긍정 신호')+' · '+found.length+'회':'관찰 필요'));}).join('');
    return back()+eyebrow('PLAYER GROWTH')+div('club-profile',avatar(person.name,false,true)+h('div',{},title(person.name)+h('span',{class:'club-muted'},person.age+' · '+c.level+' 과정')))+p(period,'club-period')+
      div('club-metrics',metric('참여 수업',String(stats.attended.length))+metric('출석률',stats.rate===null?'—':stats.rate+'<small style="font-size:16px">%</small>')+metric('코치 관찰',String(notes.length)))+
      p('출석 '+stats.attended.length+' / 기록 완료 '+stats.recorded.length+'회 기준')+
      section('최근 4주 성장',growth+p('수업에서 관찰한 신호예요. 기록이 없는 영역은 능력을 평가하지 않습니다.'))+
      highlight('NEXT FOCUS',focus,follow.length?'두 차례의 확인 필요 기록을 바탕으로 다음 수업에서 짧은 압박 패스 미션을 함께 살펴봅니다.':positive.length?'최근 수업에서 보인 긍정적인 장면을 다음 수업에서도 이어가는지 확인합니다.':'참여 수업 이력은 쌓이고 있어요. 눈에 띄는 장면이 생기면 첫 성장 기록이 연결됩니다.',routeButton('class',c.id,'다음 클래스 · '+c.name+icon('right')),!!follow.length)+
      disclosure('코치 관찰 더 보기 · '+notes.length+'건',section('코치 하이라이트',positive.length?positive.map(noteRow).join(''):p('아직 남겨진 하이라이트가 없어요.'))+section('확인할 장면',follow.length?follow.map(noteRow).join(''):p('현재 확인 필요로 표시된 장면이 없어요.')))+
      disclosure('참여 수업 더 보기 · '+stats.attended.length+'회',stats.attended.map(s=>sessionRow(s,person)).join(''))+
      disclosure('소속 정보',facts([['클래스',routeButton('class',c.id,c.name+' · '+c.time+' →')],['담당 코치',routeButton('coach',coach.id,coach.name+' 코치 →')],['등록일',person.joined.replaceAll('-','.')]]))+demo();
  }
  function coachPage(){
    const c=getCoach(route.id),assigned=classes.filter(k=>k.coachId===c.id),recent=sessions.filter(s=>s.coachId===c.id&&inPeriod(s)),done=recent.filter(s=>s.status==='complete'),pending=recent.filter(s=>s.status==='record'),people=players.filter(p=>assigned.some(k=>k.id===p.classId)),notes=observations.filter(o=>getSession(o.sessionId).coachId===c.id);
    return back()+eyebrow('COACH DEVELOPMENT')+div('club-profile',avatar(c.name,true,true)+h('div',{},title(c.name+' 코치')+h('span',{class:'club-muted'},c.role)))+p(period,'club-period')+
      div('club-metrics',metric('담당 클래스',String(assigned.length))+metric('함께하는 원생',String(people.length))+metric('기록 완료',String(done.length)))+
      p('진행된 수업 '+recent.length+'회 중 기록 '+done.length+'회 완료'+(pending.length?' · 기록 필요 '+pending.length+'회':''))+
      section('담당 클래스',assigned.map(classRow).join(''))+
      highlight('COACHING STRENGTH',c.strength,'다음 지도 초점 · '+c.focus)+p('센터 교육 방향에 등록된 코칭 프로필','club-period')+
      disclosure('함께 다룬 커리큘럼 더 보기',[...new Set(assigned.map(k=>k.curriculum))].map(x=>div('plainrow',h('h3',{},esc(x))+p(done.filter(s=>getClass(s.classId).curriculum===x).length+'회 수업 기록'))).join(''))+
      disclosure('선수 관찰 더 보기 · '+notes.length+'건',notes.length?notes.slice(0,3).map(o=>row('player',o.playerId,getPlayer(o.playerId).name,o.area+' · '+o.tag,avatar(getPlayer(o.playerId).name),o.state==='follow'?'확인 필요':'긍정 신호',o.state==='follow')).join(''):p('아직 개별 선수 관찰 기록이 없어요.'))+
      disclosure('최근 수업 더 보기',recent.sort((a,b)=>b.date.localeCompare(a.date)||b.time.localeCompare(a.time)).slice(0,5).map(s=>sessionRow(s)).join(''))+demo();
  }
  function drills(c){
    const passing=c.curriculum==='패스 & 움직임'||c.curriculum==='압박 대응';
    const items=passing?[[10,'볼 감각 워밍업','짧은 터치로 준비하기'],[15,'2인 패스','받기 전 동료와 주변을 확인하기'],[20,c.curriculum==='압박 대응'?'압박 패스':'패스 후 이동','패스한 뒤 빈 공간으로 움직이기'],[15,'미니게임','배운 선택을 경기에서 시도하기']]:[[10,'움직임 워밍업','몸과 공에 익숙해지기'],[15,c.curriculum+' 미션',c.goal],[20,'2인 연결 연습','동료와 번갈아 시도하기'],[15,'미니게임','오늘의 목표를 경기 속에서 찾아보기']];
    return items.map(([time,t,tip])=>div('club-drill',h('time',{},time+'분')+h('div',{},h('strong',{},esc(t))+p(tip)))).join('');
  }
  function classPage(){
    const c=getClass(route.id),coach=getCoach(c.coachId),recent=classSessions(c).filter(inPeriod),pending=recent.filter(s=>s.status==='record');
    const peopleButton=label=>h('button',{'data-club-roster':c.id},label);
    return heading('CLASS',c.name,c.age+' · '+c.level+' · '+c.days+' '+c.time+'–'+endTime(c))+
      highlight('CLASS GOAL',c.goal,c.curriculum+' 커리큘럼')+
      facts([['담당 코치',routeButton('coach',coach.id,coach.name+' 코치 →')],['참여 원생',peopleButton(roster(c).length+'명 전체 보기 →')]])+
      disclosure('수업 정보 더 보기',facts([['수업 장소',c.venue],['다음 수업',nextSession(c)],['표준 수업',c.templateId]]))+
      disclosure('실제 수업 기록 · '+recent.length+'회',p(period+' · 완료 '+recent.filter(s=>s.status==='complete').length+'회'+(pending.length?' · 기록 필요 '+pending.length+'회':''),'club-period')+recent.map(s=>sessionRow(s)).join(''))+demo();
  }
  function sessionPage(){
    const s=getSession(route.id),c=getClass(s.classId),coach=getCoach(s.coachId),notes=observations.filter(o=>o.sessionId===s.id),recorded=s.status==='complete';
    return heading('SESSION RECORD',c.name,dateText(s.date)+' · '+s.time+'–'+endTime(c)+' · '+(recorded?'수업 완료':'기록 필요'))+
      facts([['담당 코치',routeButton('coach',coach.id,coach.name+' 코치 →')],['클래스',routeButton('class',c.id,c.name+' · '+c.time+' →')],['사용한 표준 수업',s.templateId],['출석',recorded?(roster(c).length-s.absent.length)+' / '+roster(c).length+'명':'미확정']])+
      highlight(recorded?'SESSION GOAL':'RECORD PENDING',s.goal,recorded?'진행한 수업 목표와 선수 관찰이 함께 저장된 예시입니다.':'수업 시간은 종료됐어요. 코치가 완료 기록을 남기면 출석과 진행한 드릴이 확정됩니다.','',!recorded)+
      disclosure(recorded?'진행한 훈련 더 보기':'예정된 훈련 더 보기',s.trainingBlocks?s.trainingBlocks.map(b=>div('club-drill',h('time',{},b.minutes+'분')+h('div',{},h('strong',{},esc(b.title))+p(b.goal)))).join(''):drills(c))+(s.coachNote?disclosure('코치 메모 더 보기',p(s.coachNote)): '')+
      (!recorded?h('button',{'data-act':'record','data-id':c.id,class:'club-record-cta'},'수업 마무리 기록하기'):'')+
      section('눈에 띈 선수',notes.length?notes.map(o=>row('player',o.playerId,getPlayer(o.playerId).name,o.area+' · '+o.tag,avatar(getPlayer(o.playerId).name),o.state==='follow'?'! 확인 필요':o.state==='growing'?'↗ 성장 신호':'✓ 좋음',o.state==='follow')).join(''):p(recorded?'개별 관찰을 남긴 선수는 없어요. 참여 이력은 출석 원생에게 연결됩니다.':'아직 코치 기록이 없어요.'))+
      disclosure((recorded?'출석 명단':'참여 예정 명단')+' 더 보기 · '+roster(c).length+'명',roster(c).map(person=>row('player',person.id,person.name,recorded?(s.absent.includes(person.id)?'결석':'출석'):'출석 미확정',avatar(person.name))).join(''))+demo();
  }
  const renders={home,players:listing,coaches:listing,classes:listing,player:playerPage,coach:coachPage,class:classPage,session:sessionPage};
  function render(focus=true,restore=0){screen.innerHTML=renders[route.view]();root.dispatchEvent(new CustomEvent('fc-club-render',{detail:{...route}}));scroll.scrollTo({top:restore,behavior:'instant'});if(focus)screen.querySelector('h1')?.focus({preventScroll:true});}
  function go(view,id='',extra={}){stack.push({...route,scroll:scroll.scrollTop});route={view,id,query:'',filter:'전체',...extra};render();}
  function refreshResults(){screen.querySelector('#fc-club-results').innerHTML=listRows();screen.querySelector('#fc-club-result-count').textContent=resultCount();screen.querySelectorAll('[data-club-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.clubFilter===route.filter)));}
  screen.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-club-back')){route=stack.pop()||{view:'home',query:'',filter:'전체'};render(true,route.scroll||0);}
    else if(b.dataset.clubRoute)go(b.dataset.clubRoute,b.dataset.id||'');
    else if(b.dataset.clubRoster)go('players','',{classId:b.dataset.clubRoster});
    else if(b.dataset.clubFilter){route.filter=b.dataset.clubFilter;refreshResults();}
    else if(b.hasAttribute('data-club-reset')){route.query='';route.filter='전체';screen.querySelector('#fc-club-search').value='';refreshResults();}
  });
  screen.addEventListener('input',e=>{if(e.target.id==='fc-club-search'){route.query=e.target.value;refreshResults();}});
  root.addEventListener('click',e=>{if(e.target.closest('.nav [data-tab="club"]')){stack=[];route={view:'home',query:'',filter:'전체'};render(false);}});
  window.FCClub={coaches,classes,players,sessions,observations,getClass,getCoach,getPlayer,getSession,roster,notesFor,statsFor,current:()=>({...route}),refresh:()=>render(false),show:(view,id)=>go(view,id),resume:r=>{route={...r};render(false);}};
  render(false);
})();
