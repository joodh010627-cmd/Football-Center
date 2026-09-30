  const views={plan:planPage,planDone,record:recordPage,recordDone,blockLibrary:libraryPage,blockDetail,blockEdit,blockClassPicker,forms:formsPage,formCatalog,responseList,formLinks:formLinksPage,formEdit,formLink:linkPage,formPreview,responseDone,response:responsePage,schedule:schedulePage,daySchedule,supportHub,eventEdit,event:eventPage,partners:partnerPage,partner:partnerDetail,apply:applicationPage,application:applicationDone,clubNews:clubNewsPage,clubNewsDetail,clubBrand:clubBrandPage};
  function redraw(){const y=scroller.scrollTop;render(false);scroller.scrollTo({top:y,behavior:'instant'});}
  function tabHome(name){stack=[];route={view:name==='forms'?'forms':'schedule',args:{},tab:name};render(false);}
  async function act(action,id,button){
    if(action==='noop')return;
    if(action==='back')return back();
    if(action==='nav-class'){route=null;return root.querySelector('.nav [data-tab="class"]').click();}
    if(action==='forms-home')return tabHome('forms');
    if(action==='schedule-home')return tabHome('schedule');
    if(action==='club-news')return go('clubNews',{},'club');
    if(action==='club-news-detail')return go('clubNewsDetail',{id},'club');
    if(action==='club-brand')return go('clubBrand',{id},'club');
    if(action==='plan')return startPlan(id);
    if(action==='plan-preview')return go('planDone',{id},'class');
    if(action==='library-home'){blockFilter='all';return launch('blockLibrary',{picking:false},'club');}
    if(action==='block-library'){blockFilter='all';return go('blockLibrary',{picking:true});}
    if(action==='block-filter'){blockFilter=id;return redraw();}
    if(action==='block-detail'||action==='plan-block'||action==='plan-block-view')return go('blockDetail',{id,picking:action==='plan-block'||(action==='block-detail'&&!!route.args.picking)});
    if(action==='block-toggle'||action==='block-detail-toggle'){planDraft.blockIds=planDraft.blockIds.includes(id)?planDraft.blockIds.filter(x=>x!==id):[...planDraft.blockIds,id];syncPlan(planDraft);return action==='block-detail-toggle'?back():redraw();}
    if(action==='blocks-done')return back();
    if(action==='block-remove'){planDraft.blockIds=planDraft.blockIds.filter(x=>x!==id);syncPlan(planDraft);return redraw();}
    if(action==='block-up'||action==='block-down'){const i=planDraft.blockIds.indexOf(id),j=i+(action==='block-up'?-1:1);if(j>=0&&j<planDraft.blockIds.length)[planDraft.blockIds[i],planDraft.blockIds[j]]=[planDraft.blockIds[j],planDraft.blockIds[i]];syncPlan(planDraft);return redraw();}
    if(action==='block-new'){blockDraft={area:blockFilter==='all'?'technical':blockFilter,title:'',goal:'',observe:'',minutes:10,setup:'',steps:'',cue:''};return go('blockEdit',{picking:!!route.args.picking});}
    if(action==='block-save')return saveBlock();
    if(action==='block-use')return go('blockClassPicker',{blockId:id});
    if(action==='block-to-class'){const blockId=route.args.blockId;startPlan(id);if(!planDraft.blockIds.includes(blockId))planDraft.blockIds.push(blockId);syncPlan(planDraft);return render();}
    if(action==='save-plan'){
      if(!planDraft.goal.trim()||!planDraft.blockIds.length){notice('수업 목표를 입력하고 훈련 블록을 하나 이상 골라주세요.');return;}
      if(planBlocks(planDraft).some(b=>!Number.isInteger(blockMinutes(planDraft,b))||blockMinutes(planDraft,b)<3||blockMinutes(planDraft,b)>60)){notice('각 블록의 시간은 3~60분 사이로 입력해주세요.');return;}
      syncPlan(planDraft);
      plans.set(planDraft.classId,JSON.parse(JSON.stringify(planDraft)));
      if(planDraft.classId==='class-3'){root.querySelector('.hero .goal').textContent=planDraft.goal;updateHero();}
      return go('planDone',{id:planDraft.classId,saved:true});
    }
    if(action==='record')return startRecord(id);
    if(action==='picker'){recordDraft.picker=!recordDraft.picker;return redraw();}
    if(action==='add-player'){const targets=planFor(recordDraft.classId).targets;recordDraft.players[id]={area:targets.includes('technical')?'technical':targets[0],state:''};recordDraft.picker=false;return redraw();}
    if(action==='remove-player'){delete recordDraft.players[id];return redraw();}
    if(action.startsWith('record-area-')){recordDraft.players[action.slice(12)].area=id;return redraw();}
    if(action.startsWith('record-state-')){recordDraft.players[action.slice(13)].state=id;return redraw();}
    if(action==='save-record')return saveRecord();
    if(action==='player-info')return openClub('player',id);
    if(action==='class-info')return openClub('class',id);
    if(action==='session-info')return openClub('session',id);
    if(action==='stage'){activeStage=id;return redraw();}
    if(action==='form-category'){activeStage=id;return go('formCatalog',{},'forms');}
    if(action==='responses'){responseFilter='all';return go('responseList',{},'forms');}
    if(action==='response-filter'){responseFilter=id;return redraw();}
    if(action==='form-links')return go('formLinks',{},'forms');
    if(action==='form-template'){makeForm(id);return go('formEdit',{},'forms');}
    if(action==='form-theme'){formDraft.theme=id;redraw();screen.querySelector('#form-options').open=true;return;}
    if(action==='form-preview'){if(!formDraft.title.trim()){notice('폼 제목을 입력해주세요.');return;}rating=0;return go('formPreview',{config:JSON.parse(JSON.stringify(formDraft))},'forms');}
    if(action==='form-link')return saveFormLink();
    if(action==='saved-link')return go('formLink',{id},'forms');
    if(action==='copy-link')return copyLink();
    if(action==='linked-preview'){rating=0;return go('formPreview',{config:formLinks.find(f=>f.id===id).config},'forms');}
    if(action==='rating'){rating=Number(id);screen.querySelectorAll('[data-act="rating"]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.id)===rating)));return;}
    if(action==='response')return go('response',{id},'forms');
    if(action==='response-state'){responses.find(r=>r.id===route.args.id).state=id;return redraw();}
    if(action==='day'){activeDay=id;return redraw();}
    if(action==='month-prev'||action==='month-next'){shiftMonth(action==='month-next'?1:-1);return redraw();}
    if(action==='month-today'){activeMonth='2026-09';activeDay='2026-09-18';return redraw();}
    if(action==='day-schedule')return go('daySchedule',{},'schedule');
    if(action==='support-hub')return go('supportHub',{},'schedule');
    if(action==='event-new'){eventDraft={kind:'match',title:'',date:activeDay,time:'10:00',place:'',target:'전 원생·학부모',note:'',prepareForm:false};return go('eventEdit',{},'schedule');}
    if(action==='event-kind'){eventDraft.kind=id;return redraw();}
    if(action==='event-save')return saveEvent();
    if(action==='event-detail')return go('event',{id},'schedule');
    if(action==='event-form'){const e=getEvent(id);if(e.linkId)return go('formLink',{id:e.linkId},'forms');makeForm(e.form,id);return go('formEdit',{},'forms');}
    if(action==='partner-list')return go('partners',{eventId:id},'schedule');
    if(action==='partner-detail')return go('partner',{eventId:route.args.eventId,partnerId:id},'schedule');
    if(action==='partner-apply')return go('apply',{eventId:route.args.eventId,partnerId:id},'schedule');
    if(action==='support-save'){
      const count=Number(screen.querySelector('[name="supportCount"]').value),note=screen.querySelector('[name="supportNote"]').value.trim();
      if(!Number.isInteger(count)||count<1||count>500){notice('예상 인원을 1~500명 사이로 입력해주세요.');return;}
      const a={id:'support-'+(applications.length+1),eventId:route.args.eventId,partnerId:route.args.partnerId,count,note};applications.push(a);return go('application',{id:a.id},'schedule');
    }
    if(action==='application')return go('application',{id},'schedule');
  }
  root.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.act){e.preventDefault();e.stopImmediatePropagation();act(b.dataset.act,b.dataset.id,b);return;}
    const key=b.dataset.open;
    if(['session','complete','create','form'].includes(key)){
      e.preventDefault();e.stopImmediatePropagation();
      if(key==='complete')startRecord('class-2');
      else if(key==='create')startPlan('class-3');
      else if(key==='form'){makeForm('invite');launch('formEdit',{},'forms');}
      else launch('planDone',{id:'class-3'},'class');
    }
  },true);
  root.addEventListener('click',e=>{
    const b=e.target.closest('.nav [data-tab]');if(!b)return;
    if(['forms','schedule'].includes(b.dataset.tab))tabHome(b.dataset.tab);else {route=null;stack=[];}
  });
  screen.addEventListener('input',e=>{
    const n=e.target.name,v=e.target.value;if(!n)return;
    if(n==='planGoal')planDraft.goal=v;
    if(n==='planNote')planDraft.note=v;
    if(n.startsWith('duration-'))planDraft.durations[n.slice(9)]=Number(v);
    if(n.startsWith('behavior-'))planDraft.behaviors[n.slice(9)]=v;
    if(n==='recordNote')recordDraft.note=v;
    if(n==='formTitle'){formDraft.title=v;const preview=screen.querySelector('.form-cover h1');if(preview)preview.textContent=v;}
    if(n==='formDate')formDraft.date=v;
    if(n==='couponText')formDraft.couponText=v;
    const eventFields={eventTitle:'title',eventDate:'date',eventTime:'time',eventPlace:'place',eventTarget:'target',eventNote:'note'};
    if(eventFields[n])eventDraft[eventFields[n]]=v;
    const blockFields={blockArea:'area',blockTitle:'title',blockGoal:'goal',blockMinutes:'minutes',blockObserve:'observe',blockSetup:'setup',blockSteps:'steps',blockCue:'cue'};
    if(blockFields[n])blockDraft[blockFields[n]]=v;
  });
  screen.addEventListener('change',e=>{
    const n=e.target.name,id=e.target.value,yes=e.target.checked;
    const toggle=(a,x,on)=>on?[...new Set([...a,x])]:a.filter(v=>v!==x);
    if(n==='drill'){recordDraft.drills=toggle(recordDraft.drills,id,yes);redraw();screen.querySelector('details').open=true;}
    if(n==='attendance'){recordDraft.absent=toggle(recordDraft.absent,id,!yes);if(!yes)delete recordDraft.players[id];redraw();}
    if(n==='formField'){formDraft.fields=toggle(formDraft.fields,id,yes);redraw();screen.querySelector('#form-options').open=true;}
    if(n==='coupon')formDraft.coupon=yes;
    if(n==='eventForm')eventDraft.prepareForm=yes;
    if(n==='eventTarget')eventDraft.target=id;
    if(n==='calendarCategory'){activeCategories=toggle(activeCategories,id,yes);redraw();screen.querySelector('#calendar-filters').open=true;}
    if(n==='blockArea')blockDraft.area=id;
    if(n.startsWith('duration-')){redraw();const el=screen.querySelector('[name="'+n+'"]');if(el)el.closest('details').open=true;}
  });
  screen.addEventListener('submit',e=>{
    if(e.target.id!=='b-parent-form')return;e.preventDefault();
    const name=e.target.querySelector('[name="answer-name"]').value.trim(),cfg=route.args.config||formDraft||linkedConfig;
    if(!name){notice('확인용 이름을 입력해주세요.');return;}
    if(cfg.fields.includes('rating')&&!rating){notice('만족도를 선택해주세요.');return;}
    const note=[...e.target.querySelectorAll('[name^="answer-"]')].filter(x=>x.name!=='answer-name'&&x.value).map(x=>x.value).join(' · ')+(rating?' · 만족도 '+rating+'/5':'');
    responses.unshift({id:'response-'+(responses.length+1),name,template:cfg.template,state:'확인 대기',date:'체험 응답',note});
    go('responseDone',{config:cfg},'forms');
  });
  function updateHero(){
    root.querySelector('.hero .edu-mini')?.remove();
    const pl=planFor('class-3'),node=document.createElement('div');node.className='edu-mini';
    node.innerHTML=btn('plan','훈련 블록 '+pl.blockIds.length+'개 · '+totalMinutes(pl)+'분 · 구성 보기 →','class-3');
    root.querySelector('.hero .goal').after(node);
  }
  root.addEventListener('fc-club-render',e=>augmentClub(e.detail));
  augmentClub(api.current());updateHero();
  root.querySelector('.wordmark').insertAdjacentHTML('afterend','<span class="small" style="font-size:11px;color:#156b46">BEYOND</span>');
  const query=new URLSearchParams(share?.query||'');
  if(document.modelContext?.registerTool && !query.has('form')){
    const lifecycle=new AbortController();
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
    const tool={name:'start_session_plan',title:'수업 설계 열기',description:'선택한 클래스의 훈련 목표와 관찰 행동을 편집하는 화면을 엽니다. 저장하거나 수업을 완료하지 않습니다.',inputSchema:{type:'object',properties:{classId:{type:'string'}},required:['classId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!input||typeof input.classId!=='string'||Object.keys(input).some(k=>k!=='classId')||!api.getClass(input.classId))throw new Error('유효한 클래스 ID가 필요합니다.');startPlan(input.classId);return {classId:input.classId,screen:'session_plan',saved:false};}};
    try {Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
  }
  if(query.has('form')){
    const template=getTemplate(query.get('form'))||templates[0];makeForm(template.id);let incoming={};try{incoming=JSON.parse(query.get('config')||'{}');}catch{}
    linkedConfig={...formDraft,template:template.id,title:String(incoming.title||template.title).slice(0,80),theme:['green','blue','cream'].includes(incoming.theme)?incoming.theme:'green',date:typeof incoming.date==='string'&&incoming.date.length===10?incoming.date:'',fields:Array.isArray(incoming.fields)?incoming.fields.filter(x=>template.fields.includes(x)):template.fields,coupon:incoming.coupon===true,couponText:String(incoming.couponText||'다음 참여 혜택').slice(0,80)};
    root.querySelector('.top').hidden=true;root.querySelector('.nav').hidden=true;stack=[];route={view:'formPreview',args:{config:linkedConfig},tab:'forms'};render(false);
  }
})();
