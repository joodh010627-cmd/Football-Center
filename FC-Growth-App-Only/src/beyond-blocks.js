  const blocks=[
    {id:'technical-1',area:'technical',title:'패스 & 퍼스트터치',skill:'패스',minutes:15,goal:'동료가 받기 좋은 패스와 다음 방향으로 첫 터치',setup:'2인 1조 · 공 1개 · 콘 2개',steps:'5m 간격으로 패스하고, 첫 터치를 콘 바깥으로 연결합니다. 익숙해지면 터치 수를 줄입니다.',cue:'“받을 동료를 보고, 첫 터치는 다음 방향으로.”',observe:'받기 전에 동료를 확인하고 다음 동작으로 연결'},
    {id:'technical-2',area:'technical',title:'고개 드는 드리블',skill:'드리블',minutes:12,goal:'공을 지키며 앞의 공간을 확인',setup:'3인 1조 · 선수당 공 1개 · 색깔 콘',steps:'콘 사이를 드리블하다 코치가 든 색깔의 출구로 이동합니다.',cue:'“공을 한 번, 앞을 한 번.”',observe:'드리블 중 고개를 들어 진행 방향을 선택'},
    {id:'technical-3',area:'technical',title:'받고, 겨냥하고, 슈팅',skill:'슈팅',minutes:15,goal:'첫 터치와 슈팅을 한 흐름으로 연결',setup:'2인 1조 · 미니골 · 공 3개',steps:'옆에서 오는 패스를 받고 두 번째 터치로 슈팅합니다. 좌우 역할을 바꿉니다.',cue:'“골대를 보고, 디딤발을 가까이.”',observe:'첫 터치 후 골대 방향으로 슈팅을 시도'},
    {id:'tactical-1',area:'tactical',title:'패스 후 공간 이동',skill:'오프더볼',minutes:20,goal:'패스 뒤 다시 받을 수 있는 공간 만들기',setup:'3대1 론도 · 8×8m · 콘 4개',steps:'3명이 공을 연결하고 패스한 선수는 빈 면으로 이동합니다. 2분마다 수비를 교대합니다.',cue:'“패스는 끝이 아니라 다음 움직임의 시작.”',observe:'패스한 뒤 동료를 돕는 위치로 이동'},
    {id:'tactical-2',area:'tactical',title:'보고, 받고, 판단하기',skill:'압박 대응',minutes:15,goal:'수비가 다가오기 전 다음 패스 선택',setup:'3대2 · 12×10m · 미니골 2개',steps:'공을 받기 전 어깨 너머를 확인합니다. 수비 압박의 속도와 거리를 조금씩 늘립니다.',cue:'“받기 전에 뒤를 한번 볼까?”',observe:'공을 받기 전 주변을 살피고 패스 방향을 결정'},
    {id:'tactical-3',area:'tactical',title:'공을 잃으면, 다시 연결',skill:'전환',minutes:12,goal:'공격과 수비 전환 때 맡은 역할 찾기',setup:'3대3 · 15×12m · 공 여러 개',steps:'볼 소유가 바뀌면 가까운 선수는 압박하고 나머지는 패스 길을 지킵니다.',cue:'“가까운 한 명, 뒤에서 도와줄 두 명.”',observe:'공을 잃은 뒤 자신의 다음 역할로 움직임'},
    {id:'physical-1',area:'physical',title:'움직임 준비 & 볼 감각',skill:'밸런스',minutes:10,goal:'몸의 균형을 유지하며 방향 전환',setup:'개인 공 · 콘 4개 · 10×10m',steps:'천천히 드리블하며 정지·회전·가속을 연결합니다. 각자의 속도로 시작합니다.',cue:'“무릎은 부드럽게, 멈출 때 몸의 중심을 낮게.”',observe:'멈춤과 방향 전환 중 균형을 유지'},
    {id:'physical-2',area:'physical',title:'반응 & 첫 세 걸음',skill:'민첩성',minutes:10,goal:'신호에 맞춰 빠르고 안정적으로 출발',setup:'2인 1조 · 색깔 콘 · 5m 구간',steps:'짝이 가리키는 콘을 향해 출발하고 걸어서 돌아옵니다. 충분히 쉬며 반복합니다.',cue:'“작은 첫걸음부터 빠르게.”',observe:'신호를 확인하고 균형 있게 출발'},
    {id:'physical-3',area:'physical',title:'속도를 바꾸는 볼 운반',skill:'움직임',minutes:12,goal:'상황에 맞게 달리는 속도 조절',setup:'개인 공 · 빠른 구간과 느린 구간',steps:'구간에 따라 속도를 바꿔 볼을 운반합니다. 동작이 흐트러지면 쉬었다가 시작합니다.',cue:'“빠르게 간 뒤에도 공은 가까이.”',observe:'속도를 바꿔도 공과 몸의 간격을 조절'},
    {id:'mental-1',area:'mental',title:'다시 도전하는 미니게임',skill:'회복력',minutes:15,goal:'실수 뒤 다음 플레이에 다시 참여',setup:'3대3 · 미니골 · 3분씩 교대',steps:'공을 잃어도 다음 패스 기회를 찾습니다. 코치는 재도전한 구체적인 장면을 짚어줍니다.',cue:'“방금은 지나갔어. 다음 공은 어떻게 받을까?”',observe:'실수 뒤에도 공을 요청하며 다음 플레이에 참여'},
    {id:'mental-2',area:'mental',title:'한 번 더 시도하는 1대1',skill:'도전성',minutes:12,goal:'실패 경험 후 다른 돌파 방법 시도',setup:'2인 1조 · 콘 골 · 8×6m',steps:'짧은 1대1 후 방법을 하나 바꿔 다시 시도합니다. 성공 횟수로 선수를 비교하지 않습니다.',cue:'“이번엔 어떤 방법을 바꿔볼까?”',observe:'같은 상황에서 새로운 움직임을 시도'},
    {id:'mental-3',area:'mental',title:'집중하고 다시 시작',skill:'집중',minutes:8,goal:'훈련 전환 신호 뒤 다음 과제로 주의 이동',setup:'개인 공 · 코치 신호 · 작은 구역',steps:'자유 드리블 중 신호를 듣고 공을 멈춘 뒤 다음 방향을 확인합니다.',cue:'“멈추고, 듣고, 다음 방향 보기.”',observe:'전환 신호 뒤 과제를 확인하고 다시 시작'},
    {id:'attitude-1',area:'attitude',title:'이름을 부르는 팀 게임',skill:'소통',minutes:15,goal:'동료와 신호를 주고받으며 패스 연결',setup:'3대3 · 미니골 · 역할 교대',steps:'패스를 요청할 때 동료를 부르고 받을 준비를 알립니다. 역할을 돌아가며 맡습니다.',cue:'“준비됐다는 신호를 서로 알려주자.”',observe:'동료에게 말이나 손짓으로 패스 의사를 표현'},
    {id:'attitude-2',area:'attitude',title:'함께 푸는 패스 미션',skill:'협력',minutes:12,goal:'동료의 위치와 준비에 맞춰 패스 조절',setup:'4인 1조 · 공 1개 · 콘 4개',steps:'모두가 공을 받은 뒤 목표 구역까지 연결합니다. 팀이 함께 방법을 정합니다.',cue:'“아직 못 받은 친구는 어디 있을까?”',observe:'동료가 참여할 수 있도록 패스나 위치를 조절'},
    {id:'attitude-3',area:'attitude',title:'설명하고 역할 바꾸기',skill:'학습 태도',minutes:8,goal:'훈련의 한 가지 포인트를 말로 설명하고 적용',setup:'2인 1조 · 익숙한 패스 훈련',steps:'한 명이 오늘의 포인트를 설명하고 다른 선수가 시도합니다. 짧게 역할을 바꿉니다.',cue:'“오늘 바꿔본 한 가지를 알려줄래?”',observe:'코칭 포인트를 이해한 말이나 동작으로 표현'}
  ];
  const getBlock=id=>blocks.find(b=>b.id===id);
  const planBlocks=pl=>pl.blockIds.map(getBlock).filter(Boolean);
  const blockMinutes=(pl,b)=>Number(pl.durations?.[b.id]??b.minutes);
  const totalMinutes=pl=>planBlocks(pl).reduce((n,b)=>n+blockMinutes(pl,b),0);
  function syncPlan(pl){pl.targets=[...new Set(planBlocks(pl).map(b=>b.area))];pl.behaviors=Object.fromEntries(pl.targets.map(id=>[id,planBlocks(pl).find(b=>b.area===id).observe]));pl.basic=planBlocks(pl).find(b=>b.area==='technical')?.skill||'기본기';return pl;}
  function blockTile(b,picking=false){const chosen=picking&&planDraft.blockIds.includes(b.id);return div('block-tile',btn('block-detail',div('block-meta',tag(getArea(b.area).name)+h('span',{},b.minutes+'분'))+h('h3',{},esc(b.title))+p(b.goal),b.id,'block-open')+(picking?btn('block-toggle',chosen?'✓':'＋',b.id,'block-select '+(chosen?'selected':'')):'')+(picking?h('span',{class:'sr-only'},chosen?'선택됨':'미선택'):''));}
  function libraryPage(){const picking=route.args.picking,shown=blocks.filter(b=>blockFilter==='all'||b.area===blockFilter);return title('CLUB BLOCK LIBRARY','우리 클럽 훈련 블록','목표를 고르고, 좋은 수업을 이어갑니다.')+
    div('library-meta',h('span',{},'공용 블록 '+blocks.length+'개')+btn('block-new','+ 블록 만들기'))+
    div('scroll-chips',choices('block-filter',[['all','전체'],...areas.map(a=>[a.id,a.name])],blockFilter))+
    div('block-list',shown.map(b=>blockTile(b,picking)).join(''))+
    (picking?div('sticky-action',div('headerline',h('strong',{},planDraft.blockIds.length+'개 선택')+p(totalMinutes(planDraft)+'분'))+btn('blocks-done','수업에 담기','','primary wide')):p('클럽 코치가 같은 목표와 코칭 기준으로 활용하는 기본 블록입니다.','demo-note'))+demo();}
  function blockDetail(){const b=getBlock(route.args.id),picking=route.args.picking,chosen=picking&&planDraft.blockIds.includes(b.id);return title('TRAINING BLOCK',b.title,getArea(b.area).name+' · '+b.skill+' · '+b.minutes+'분')+
    surface('GOAL',b.goal,'U8–U12 · 수준에 맞게 거리와 속도를 조절하세요.')+
    sec('이렇게 진행해요',p(b.setup,'block-setup')+p(b.steps,''))+
    sec('코칭 한마디',p(b.cue,'coach-cue'))+sec('관찰할 장면',p(b.observe,''))+
    (picking?btn('block-detail-toggle',chosen?'수업에서 빼기':'이 블록 담기',b.id,'primary wide'):btn('block-use','이 블록으로 수업 구성',b.id,'primary wide'))+
    p('훈련에서 보인 축구 행동을 기록합니다. 사람의 성격이나 인성을 평가하지 않습니다.','demo-note');}
  function blockEdit(){return title('NEW CLUB BLOCK','함께 쓸 블록 만들기','한 가지 목표와 관찰할 장면이면 충분해요.')+
    select('훈련 영역','blockArea',areas.map(a=>[a.id,a.name]),blockDraft.area)+field('블록 이름','blockTitle',blockDraft.title,'text','maxlength="50"')+
    field('훈련 목표','blockGoal',blockDraft.goal,'text','maxlength="120" placeholder="예: 패스한 뒤 빈 공간으로 이동"')+
    field('시간 · 분','blockMinutes',blockDraft.minutes,'number','min="3" max="60"')+
    field('관찰할 장면','blockObserve',blockDraft.observe,'text','maxlength="140" placeholder="예: 패스 후 동료를 돕는 위치로 이동"')+
    h('details',{},h('summary',{},'진행 방법·코칭 포인트 추가')+field('준비와 구성','blockSetup',blockDraft.setup)+areaField('진행 방법','blockSteps',blockDraft.steps)+field('코칭 한마디','blockCue',blockDraft.cue))+
    error()+btn('block-save','클럽 블록으로 저장','','primary wide')+demo();}
  function blockClassPicker(){return title('USE THIS BLOCK','어떤 수업에 쓸까요?',getBlock(route.args.blockId).title)+api.classes.map(c=>row('block-to-class',c.id,c.name,c.days+' '+c.time+' · '+api.getCoach(c.coachId).name+' 코치')).join('');}
  function saveBlock(){const b=blockDraft;if(!b.title.trim()||!b.goal.trim()||!b.observe.trim()||!Number.isInteger(Number(b.minutes))||b.minutes<3||b.minutes>60){notice('이름·목표·관찰 장면과 3~60분 사이의 시간을 입력해주세요.');return;}const block={...b,id:'club-block-'+(blocks.length+1),minutes:Number(b.minutes),skill:b.title,setup:b.setup||'코치가 수업에 맞게 준비해 주세요.',steps:b.steps||'목표에 맞게 난이도를 조절하며 진행합니다.',cue:b.cue||'관찰할 장면을 한 가지 짚어주세요.'};blocks.push(block);blockFilter=block.area;if(route.args.picking){planDraft.blockIds.push(block.id);syncPlan(planDraft);}back();}
