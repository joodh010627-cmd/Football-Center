  const templates=[
    {id:'invite',stage:'invite',title:'첫 수업에 초대합니다',label:'체험 초대',desc:'신청부터 준비물·첫 수업 안내까지',guide:['체험 신청','일정 확인','준비물 안내'],fields:['age','date','note']},
    {id:'status',stage:'manage',title:'함께하는 시간을 조정해요',label:'원생 상태·상담',desc:'휴원·복귀·반 변경 요청',guide:['변경 요청','코치 확인','상태 반영'],fields:['age','request','note']},
    {id:'program',stage:'manage',title:'새로운 도전에 함께해요',label:'프로그램 참가',desc:'특강·대회·선택 프로그램 신청',guide:['프로그램 확인','참여 신청','일정 안내'],fields:['age','program','note']},
    {id:'parents',stage:'event',title:'학부모의 밤',label:'학부모의 밤',desc:'교육 방향·성장 이야기·참석 확인',guide:['행사 안내','참석 인원 확인','궁금한 점 접수'],fields:['count','question']},
    {id:'camp',stage:'event',title:'함께 성장하는 전지훈련',label:'전지훈련',desc:'참가 의향·준비 안내·문의',guide:['일정 안내','참가 의향','준비물 확인'],fields:['age','count','question']},
    {id:'season',stage:'event',title:'계절을 함께 뛰어요',label:'하계·동계 체험',desc:'시즌 체험·시간대·신청',guide:['시즌 선택','체험 시간 확인','신청 접수'],fields:['age','season','date']},
    {id:'finish',stage:'finish',title:'함께한 시간은 어땠나요?',label:'만족도·다음 혜택',desc:'서비스 종료 후 피드백과 쿠폰',guide:['경험 돌아보기','개선 의견','다음 참여 혜택'],fields:['rating','feedback']}
  ];
  const getTemplate=id=>templates.find(t=>t.id===id);
  const stageLabels=[['invite','초대·유입'],['manage','원생·프로그램'],['event','행사'],['finish','마무리']];
  const fieldLabels={age:'연령대',date:'희망 날짜',note:'전하고 싶은 말',request:'변경 요청',program:'참여 프로그램',count:'참석 인원',question:'미리 묻고 싶은 점',season:'시즌 선택',rating:'만족도',feedback:'개선 의견'};
  const formLinks=[], responses=[
    {id:'response-1',name:'김지우 보호자',template:'invite',state:'체험 예정',date:'9.19',note:'U10 체험을 희망합니다.'},
    {id:'response-2',name:'이도윤 보호자',template:'program',state:'확인 대기',date:'9.18',note:'기본기 특강 참가를 신청합니다.'},
    {id:'response-3',name:'박서준 보호자',template:'status',state:'휴원 상담',date:'9.18',note:'10월 일정 조정을 상담하고 싶습니다.'}
  ];
  function makeForm(id,eventId=''){const t=getTemplate(id),ev=events.find(e=>e.id===eventId);formDraft={template:t.id,title:ev?ev.title+' 참가 안내':t.title,date:ev?.date||'',eventId,theme:'green',fields:t.fields.slice(),coupon:false,couponText:'다음 프로그램 참여 혜택'};}
  function formsPage(){const waiting=responses.filter(r=>r.state==='확인 대기').length,trial=responses.filter(r=>r.state==='체험 예정').length;return title('FORMS','새로운 만남의 시작','초대부터 다음 안내까지, 간단하게.')+
    div('response-overview',h('span',{class:'eyebrow'},'NEEDS YOUR ATTENTION')+div('countline',h('strong',{},String(waiting))+h('span',{},'건 확인 대기'))+p('체험 예정 '+trial+'건 · 전체 응답 '+responses.length+'건')+btn('responses','응답 내역 더 보기 →','','text-link'))+
    sec('어떤 안내가 필요한가요?',div('form-purpose-grid',stageLabels.map(([id,label],i)=>btn('form-category',h('span',{class:'purpose-icon'},['↗','≡','▦','✓'][i])+h('strong',{},label)+h('small',{},['체험 초대·첫 수업','상태 변경·참가 신청','학부모의 밤·캠프','만족도·다음 혜택'][i]),id)).join('')))+
    btn('form-template','체험 초대 폼 만들기','invite','primary wide')+
    row('form-links','', '만든 링크 보기',formLinks.length+'개의 안내 링크')+demo();}
  function formCatalog(){return title('FORM LIBRARY',stageLabels.find(x=>x[0]===activeStage)[1],'기본 폼을 골라 제목과 일정만 맞추세요.')+choices('stage',stageLabels,activeStage)+templates.filter(t=>t.stage===activeStage).map(t=>row('form-template',t.id,t.label,t.desc)).join('');}
  function responseList(){const list=responses.filter(r=>responseFilter==='all'||r.state==='확인 대기');return title('RESPONSE HISTORY','응답 내역','필요한 응답을 열어 내용과 진행 상태를 확인하세요.')+choices('response-filter',[['all','전체 '+responses.length],['waiting','확인 대기 '+responses.filter(r=>r.state==='확인 대기').length]],responseFilter)+(list.length?list.map(r=>row('response',r.id,r.name,getTemplate(r.template).label+' · '+r.date,r.state)).join(''):div('empty','확인 대기 중인 응답이 없어요.'))+demo();}
  function formLinksPage(){return title('YOUR LINKS','만든 안내 링크',formLinks.length+'개')+(formLinks.length?formLinks.map(f=>row('saved-link',f.id,f.config.title,getTemplate(f.config.template).label)).join(''):div('empty',p('아직 만든 안내 링크가 없어요.')+btn('form-template','첫 체험 초대 만들기','invite','text-link')))+demo();}
  function formEdit(){
    const t=getTemplate(formDraft.template);
    return title('FORM TEMPLATE',t.label,'기본 구조가 준비되어 있어요. 필요한 질문만 남기세요.')+
      div('steps',t.guide.map((g,i)=>h('span',{class:'on'},(i+1)+' '+g)).join(''))+
      field('폼 제목','formTitle',formDraft.title,'text','maxlength="80"')+field('연결할 날짜 · 선택','formDate',formDraft.date,'date')+
      div('form-summary',tag('기본 질문 '+(formDraft.fields.length+1)+'개 준비됨')+p('보호자 이름 + '+formDraft.fields.map(k=>fieldLabels[k]).join(' · ')))+
      h('details',{id:'form-options'},h('summary',{},'질문·디자인 맞춤 설정')+sec('안내 디자인',choices('form-theme',[['green','그린'],['blue','네이비'],['cream','크림']],formDraft.theme))+
      sec('질문 선택',p('보호자 이름은 기본 항목입니다.')+t.fields.map(k=>check(fieldLabels[k],'formField',k,formDraft.fields.includes(k))).join('')))+
      (t.id==='finish'?h('details',{},h('summary',{},'마무리 혜택 추가')+check('응답 후 쿠폰 안내 보여주기','coupon','yes',formDraft.coupon)+field('혜택 문구','couponText',formDraft.couponText,'text','maxlength="80"')):'')+
      error()+btn('form-preview','학부모 화면 미리보기','','secondary wide')+btn('form-link','링크 만들기','','primary wide')+
      p('공유용 미리보기 링크를 만듭니다. 실제 응답 수집·쿠폰 발송은 연결되지 않은 목업입니다.','demo-note');}
  function configLink(config){const url=new URL((share?.origin||'https://fc-growth-beyond.smcmm0303.chatgpt.site')+'/');url.searchParams.set('form',config.template);url.searchParams.set('config',JSON.stringify(config));return url.href;}
  function linkPage(){const item=formLinks.find(f=>f.id===route.args.id);return title('READY TO SHARE','안내 링크를 만들었어요',item.config.title)+
    surface('PREVIEW LINK','복사해서 화면을 확인하세요','링크에는 폼 제목·날짜·선택 질문만 들어갑니다. 실제 응답은 수집하지 않습니다.')+
    h('label',{class:'field'},'폼 미리보기 주소'+'<input class="form-link" id="b-form-link" readonly value="'+esc(item.url)+'">')+
    btn('copy-link','링크 복사','','primary wide')+btn('linked-preview','폼 미리보기',item.id,'secondary wide')+error()+demo();}
  function previewInput(key){if(key==='rating')return h('div',{class:'field'},'이번 경험은 어땠나요?'+div('rating',[1,2,3,4,5].map(n=>h('button',{'data-act':'rating','data-id':String(n),'aria-pressed':String(rating===n),type:'button'},String(n))).join(''))+p('1 아쉬워요 · 5 만족해요'));
    if(key==='age')return select('연령대','answer-age',[['U8','U8'],['U10','U10'],['U12','U12']],'U10');
    if(key==='date')return field('희망 날짜','answer-date','','date');
    if(key==='count')return select('참석 인원','answer-count',[['1','1명'],['2','2명'],['3','3명'],['4','4명 이상']],'2');
    if(key==='request')return select('변경 요청','answer-request',[['휴원','휴원 상담'],['복귀','복귀 신청'],['반 변경','반 변경 상담']],'휴원');
    if(key==='program')return select('참여 프로그램','answer-program',[['기본기 특강','기본기 특강'],['교류 대회','교류 대회'],['팀 훈련','팀 훈련']],'기본기 특강');
    if(key==='season')return select('시즌','answer-season',[['하계','하계 체험'],['동계','동계 체험']],'동계');
    return areaField(fieldLabels[key]+' · 선택','answer-'+key,'','한두 문장으로 적어주세요');}
  function formPreview(){
    const cfg=route.args.config||formDraft||linkedConfig,t=getTemplate(cfg.template);
    return (stack.length?btn('back','← 이전 화면','','back'):'')+
      div('form-cover '+cfg.theme,h('span',{class:'eyebrow'},'FC GROWTH · '+t.label)+h('h1',{tabindex:'-1'},esc(cfg.title))+p('서초 그린 유나이티드')+(cfg.date?p(cfg.date.replaceAll('-','.')):''))+
      p('공유용 미리보기 · 실제 신청이나 응답은 전송되지 않습니다.','demo-note')+
      div('steps',t.guide.map((x,i)=>h('span',{class:'on'},(i+1)+' '+x)).join(''))+
      '<form id="b-parent-form">'+field('보호자 이름','answer-name','','text','required maxlength="40" placeholder="목업 확인용 이름"')+cfg.fields.map(previewInput).join('')+
      error()+'<button class="primary wide" type="submit">체험 응답 확인</button></form>';}
  function responseDone(){const cfg=route.args.config;return title('THANK YOU','의견을 확인했어요','이 화면의 체험 기록에만 반영됩니다.')+surface('NEXT STEP','다음 만남도 함께해요','정식 서비스에서는 센터 확인과 안내 발송으로 이어지는 단계입니다.')+
    (cfg.coupon?sec('다음 참여 혜택',h('div',{class:'form-cover cream'},h('span',{class:'eyebrow'},'COUPON PREVIEW')+h('h2',{},esc(cfg.couponText))+p('체험용 쿠폰 · 실제 사용 불가'))):'')+
    (share?.query&&new URLSearchParams(share.query).has('form')?'':btn('forms-home','폼으로 돌아가기','','primary wide'))+demo();}
  function responsePage(){const r=responses.find(x=>x.id===route.args.id);return title('RESPONSE',r.name,getTemplate(r.template).label+' · '+r.date)+facts([['진행 상태',r.state],['응답 유형',getTemplate(r.template).label]])+
    sec('남겨주신 내용',p(r.note||'추가 의견이 없어요.',''))+sec('상태 관리',choices('response-state',[['확인 대기','확인 대기'],['체험 예정','체험 예정'],['등록 안내','등록 안내'],['휴원 상담','휴원 상담'],['안내 완료','안내 완료']],r.state))+p('선택한 상태는 이 체험 화면에서만 바뀝니다.','demo-note')+demo();}
  function saveFormLink(){if(!formDraft.title.trim()){notice('폼 제목을 입력해주세요.');return;}const item={id:'link-'+(formLinks.length+1),config:JSON.parse(JSON.stringify(formDraft))};item.url=configLink(item.config);formLinks.unshift(item);if(item.config.eventId){const ev=events.find(e=>e.id===item.config.eventId);if(ev)ev.linkId=item.id;}go('formLink',{id:item.id},'forms');}
  async function copyLink(){const input=screen.querySelector('#b-form-link');input.select();input.setSelectionRange?.(0,input.value.length);try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(input.value);else if(!document.execCommand('copy'))throw Error('manual');notice('링크를 복사했어요.');}catch{notice('주소를 길게 눌러 복사해주세요.');}}
