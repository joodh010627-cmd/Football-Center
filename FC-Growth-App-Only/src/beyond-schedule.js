  const eventKinds=[['class','클래스'],['match','대회'],['event','클럽행사'],['camp','캠프'],['break','휴무']];
  const partners=[
    {id:'snack',name:'플레이스낵',kind:'간식·음료',support:'개별 포장 간식 40세트',eligibility:'대회·클럽 행사·캠프 · 보관·알레르기 표시 확인',description:'축구 가족에게 제품을 체험시키는 가상 식품 브랜드 캠페인입니다.',activation:'수령 수량 확인 · 현장 배포 · 보호자용 제품 안내 QR',conversion:'보호자가 원하는 경우 브랜드몰 구매 혜택을 확인합니다. 구매는 수업·행사 참여 조건이 아닙니다.'},
    {id:'meal',name:'팀테이블',kind:'도시락·팀 식사',support:'사전 단체 주문 혜택',eligibility:'행사·대회·캠프 · 메뉴·수량·배송 시간 확정',description:'필요한 식사를 사전 주문으로 연결하는 가상 제안입니다. 식사 전량 무료 제공은 아닙니다.',activation:'희망 수량 취합 · 업체 메뉴·가격 확인 · 지정 장소 수령',conversion:'확정 단체 주문과 가족 재방문 코드를 연결합니다. 조리·배송·환불은 판매자와 사전 합의합니다.'},
    {id:'gear',name:'온필드 스포츠',kind:'스포츠웨어·용품',support:'팀 체험 키트 1세트',eligibility:'대회·캠프 · 제품 사용과 브랜드 안내 가능 일정',description:'제품을 실제로 써보고 보호자가 필요한 상품을 선택하는 가상 체험 캠페인입니다.',activation:'제품 체험 · 협찬 표시 · 보호자용 브랜드몰 코드 안내',conversion:'사이즈·구매는 브랜드몰에서 선택하고 배송·교환은 브랜드가 담당합니다.'},
    {id:'outdoor',name:'캠프메이트',kind:'캠핑·야외용품',support:'캠핑 의자 10개 대여',eligibility:'캠프·야외 대회 · 설치·회수 장소 확인',description:'보호자의 대기 공간을 제품 체험 구역으로 만드는 가상 렌탈 협찬입니다.',activation:'휴식 구역 제공 · 체험 제품 안내 · 장비 인수·회수 확인',conversion:'관심 있는 보호자가 동일 제품의 구매·렌탈 조건을 직접 확인합니다. 파손·회수 조건을 먼저 합의합니다.'},
    {id:'care',name:'리커버리 랩',kind:'병원·건강 교육',support:'보호자 교육 1회 · 검토 후',eligibility:'광고·교육의 적법성과 집행 조건 개별 검토',description:'지역 보호자를 위한 건강 교육 협찬의 구조 예시입니다. 실제 진료나 예약을 제공하지 않습니다.',activation:'검토된 교육·콘텐츠 진행 · 참석·집행 결과 확인',conversion:'환자 소개·예약·진료비 연동 수수료는 제외합니다. 고정 광고·교육 계약도 의료광고 규정 등을 검토한 뒤 집행합니다.'}
  ];
  const getEvent=id=>events.find(e=>e.id===id);
  const scheduleClasses=date=>{const day=new Date(date+'T12:00:00Z').getUTCDay();return api.classes.filter(c=>({'화·금':[2,5],'월·목':[1,4],'수·토':[3,6]})[c.days].includes(day));};
  function calendarList(date){return [...(activeCategories.includes('class')?scheduleClasses(date).map(c=>({time:c.time,id:c.id,title:c.name,sub:api.getCoach(c.coachId).name+' 코치 · '+c.venue,kind:'class',act:'class-info'})):[]),...events.filter(e=>e.date===date&&activeCategories.includes(e.kind)).map(e=>({time:e.kind==='break'?'종일':e.time,id:e.id,title:e.title,sub:e.place||e.target,kind:e.kind,act:'event-detail'}))].sort((a,b)=>a.time.localeCompare(b.time));}
  const scheduleRows=list=>list.map(e=>row(e.act,e.id,e.title,e.sub,eventKinds.find(k=>k[0]===e.kind)[1],e.time)).join('');
  function monthGrid(){
    const [year,month]=activeMonth.split('-').map(Number),first=new Date(Date.UTC(year,month-1,1)).getUTCDay(),length=new Date(Date.UTC(year,month,0)).getUTCDate(),cells=Math.ceil((first+length)/7)*7;
    return div('calendar-weekdays',['일','월','화','수','목','금','토'].map(d=>h('span',{},d)).join(''))+div('month-grid',Array.from({length:cells},(_,i)=>{const n=i-first+1;if(n<1||n>length)return h('span',{'aria-hidden':'true'},'');const date=activeMonth+'-'+String(n).padStart(2,'0'),list=calendarList(date),hasClass=list.some(e=>e.kind==='class'),hasClub=list.some(e=>e.kind!=='class');return h('button',{'data-act':'day','data-id':date,'aria-pressed':String(date===activeDay),'aria-label':month+'월 '+n+'일 · 일정 '+list.length+'개',class:(date==='2026-09-18'?'is-today ':'')+(i%7===0?'sunday':'')},h('span',{},String(n))+div('calendar-dots',(hasClass?'<i class="class-dot"></i>':'')+(hasClub?'<i class="club-dot"></i>':'')));}).join(''));
  }
  function schedulePage(){
    const list=calendarList(activeDay),[year,month]=activeMonth.split('-');
    return h('span',{class:'eyebrow'},'CLUB SCHEDULE')+
      div('month-toolbar',h('h1',{tabindex:'-1'},Number(month)+'월 '+h('small',{},year))+div('month-controls',btn('month-prev','‹','','month-arrow')+btn('month-today','오늘','','text-link')+btn('month-next','›','','month-arrow')))+
      monthGrid()+div('calendar-legend',h('span',{},'<i class="class-dot"></i> 클래스')+h('span',{},'<i class="club-dot"></i> 클럽 일정')+btn('event-new','+ 일정 추가','','text-link'))+
      h('details',{id:'calendar-filters',class:'calendar-filters'},h('summary',{},'일정 종류 · '+activeCategories.length+'개 표시')+eventKinds.map(([id,label])=>check(label,'calendarCategory',id,activeCategories.includes(id))).join(''))+
      btn('support-hub',div('copy',h('strong',{},'대회·캠프 협찬 찾기')+h('small',{},'간식 · 도시락 · 스포츠·캠핑용품'))+h('span',{},'↗'),'','support-entry calendar-support')+
      div('section-heading',h('h2',{},dateLabel(activeDay)+' 일정')+(list.length>2?btn('day-schedule','전체 '+list.length+'개 보기 →','','text-link'):''))+
      div('day-preview',list.length?scheduleRows(list.slice(0,2)):p('선택한 종류의 일정이 없어요.'))+
      p('협찬 제안은 가상 예시입니다. 실제 신청은 전송되지 않아요.','demo-note')+p('9월 18일 기준 체험용 일정 · 새로고침 시 초기화됩니다.','demo-note');
  }
  function daySchedule(){const list=calendarList(activeDay);return title('DAY SCHEDULE',dateLabel(activeDay)+' 전체 일정',list.length+'개 일정')+scheduleRows(list);}
  function shiftMonth(step){const [y,m]=activeMonth.split('-').map(Number),d=new Date(Date.UTC(y,m-1+step,1)),day=Number(activeDay.slice(8,10));activeMonth=iso(d).slice(0,7);const max=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();activeDay=activeMonth+'-'+String(Math.min(day,max)).padStart(2,'0');}
  function supportHub(){const eligible=events.filter(e=>['event','camp','match'].includes(e.kind)&&e.date>='2026-09-18').sort((a,b)=>a.date.localeCompare(b.date));return title('PARTNER SUPPORT','우리 팀의 다음 도전','협찬을 연결할 일정을 골라주세요.')+
    div('support-intro',h('strong',{},'우리 일정에 필요한 제품과 서비스.')+p('브랜드 혜택과 광고·체험 참여 조건을 함께 확인합니다.'))+
    sec('어떤 일정에 연결할까요?',eligible.length?eligible.map(e=>row('partner-list',e.id,e.title,dateLabel(e.date)+' · '+eventKinds.find(k=>k[0]===e.kind)[1]+' · '+e.target)).join(''):p('협찬을 연결할 대회나 행사를 먼저 만들어주세요.'))+
    btn('event-new','+ 새 일정 추가','','secondary wide')+(applications.length?sec('저장한 참여안',applications.map(a=>row('application',a.id,getEvent(a.eventId).title,partners.find(p=>p.id===a.partnerId).name+' · 초안')).join('')):'')+
    p('가상 파트너로 구성한 협찬 흐름입니다. 실제 제휴나 신청 전송은 연결되지 않았습니다.','demo-note');}
  function eventEdit(){return title('NEW EVENT','구단 일정 추가','종류를 고르면 필요한 정보만 입력합니다.')+
    choices('event-kind',eventKinds.filter(x=>x[0]!=='class'),eventDraft.kind)+field('일정 이름','eventTitle',eventDraft.title,'text','maxlength="80"')+
    field('날짜','eventDate',eventDraft.date,'date')+(eventDraft.kind!=='break'?field('시작 시간','eventTime',eventDraft.time,'time')+field('장소 · 선택','eventPlace',eventDraft.place):'')+
    select('대상','eventTarget',[['전 원생·학부모','전 원생·학부모'],['U8','U8'],['U10','U10'],['U12','U12'],['코치','코치']],eventDraft.target)+
    h('details',{},h('summary',{},'안내 내용 추가 · 선택')+areaField('안내 내용','eventNote',eventDraft.note))+
    (eventDraft.kind!=='break'?check('저장 후 참가 안내 폼 준비하기','eventForm','yes',eventDraft.prepareForm):'')+
    error()+btn('event-save','일정 추가','','primary wide')+demo();}
  function eventPage(){const e=getEvent(route.args.id),kind=eventKinds.find(k=>k[0]===e.kind)[1];return title('CLUB EVENT',e.title,kind+' · '+e.target)+
    facts([['날짜',e.date.replaceAll('-','.')],['시간',e.kind==='break'?'종일':e.time],['장소',e.place||'별도 안내']])+p(e.note,'')+
    (e.kind==='break'?'':sec('참가 안내',p('일정 정보를 넣은 기본 폼으로 준비합니다.')+btn('event-form',e.linkId?'만든 안내 링크 보기':'안내 폼 준비',e.id,'secondary wide')))+
    (['match','camp','event'].includes(e.kind)?btn('partner-list',div('copy',h('span',{class:'eyebrow'},'PARTNER SUPPORT')+h('strong',{},'이 일정에 협찬 연결')+h('small',{},'간식 · 도시락 · 스포츠·캠핑용품'))+h('span',{},'↗'),e.id,'support-entry'):'')+
    (applications.some(a=>a.eventId===e.id)?sec('준비한 참여안',applications.filter(a=>a.eventId===e.id).map(a=>row('application',a.id,partners.find(p=>p.id===a.partnerId).name,'참여안 저장 · 전송되지 않음')).join('')):'')+demo();}
  function partnerPage(){const e=getEvent(route.args.eventId);return title('PARTNER SUPPORT','필요한 혜택을 골라요',e.title+' · 협찬·광고 참여 예시')+partners.map(x=>row('partner-detail',x.id,x.name,x.kind+' · '+x.support,'가상 파트너')).join('')+
    p('간식·용품·서비스 지원과 광고 참여 조건은 계약 때 정합니다. 지금은 가상 제안입니다.','demo-note');}
  function partnerDetail(){const part=partners.find(p=>p.id===route.args.partnerId),e=getEvent(route.args.eventId);return title('PARTNER BENEFITS',part.name,part.kind+' · '+part.support)+surface('BRAND EXPERIENCE','필요한 혜택, 함께하는 경험',part.description)+
    sec('제공 조건 예시',p(part.eligibility)+facts([['연결 일정',e.title],['받는 혜택',part.support]]))+
    sec('클럽의 참여',p(part.activation))+h('details',{},h('summary',{},'보호자의 다음 선택')+p(part.conversion))+
    h('details',{},h('summary',{},'광고 수익 정산 안내')+p('기본 혜택은 간식·용품·서비스 지원입니다. 광고 수익을 나누기로 별도 계약했다면 광고 진행을 확인한 뒤 나눕니다. 운영비를 현금으로 보내지는 않습니다.')+p('나눌 금액과 비율은 광고 계약 때 정합니다.','demo-note'))+
    btn('partner-apply','협찬 참여안 준비',part.id,'primary wide')+demo();}
  function applicationPage(){const part=partners.find(p=>p.id===route.args.partnerId),e=getEvent(route.args.eventId);return title('PARTNER REQUEST','협찬 참여안',part.name+' · '+part.kind)+facts([['구단','서초 그린 유나이티드'],['일정',e.title],['대상',e.target],['날짜',e.date]])+
    field('예상 참가 인원','supportCount','30','number','min="1" max="500"')+areaField('물품·체험 참여 계획','supportNote','','배포 장소나 제품을 체험할 공간을 간단히 적어주세요')+error()+btn('support-save','참여안 저장 · 목업','','primary wide')+p('외부 업체에 전송하지 않는 참여 흐름 목업입니다.','demo-note');}
  function applicationDone(){const a=applications.find(a=>a.id===route.args.id);return title('SAVED DRAFT','참여안을 저장했어요','아직 브랜드에 제출하지 않은 목업입니다.')+facts([['연결 일정',getEvent(a.eventId).title],['파트너',partners.find(p=>p.id===a.partnerId).name],['예상 인원',a.count+'명']])+sec('참여 계획',p(a.note||'추가 내용 없음',''))+btn('event-detail','일정으로 돌아가기',a.eventId,'primary wide')+demo();}
  function saveEvent(){if(!eventDraft.title.trim()||!eventDraft.date){notice('일정 이름과 날짜를 입력해주세요.');return;}const id='evt-local-'+(events.length+1),e={...eventDraft,id,form:eventDraft.kind==='camp'?'camp':eventDraft.kind==='event'?'parents':'program'};events.push(e);activeDay=e.date;activeMonth=e.date.slice(0,7);if(!activeCategories.includes(e.kind))activeCategories.push(e.kind);if(e.prepareForm&&e.kind!=='break'){makeForm(e.form,e.id);go('formEdit',{},'forms');}else go('event',{id:e.id},'schedule');}
