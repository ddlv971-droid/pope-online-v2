
(function(){
  'use strict';
  const isPrivate = /app-private\.html/i.test(location.pathname) || document.body?.dataset?.forcedSpace==='private';
  const space = isPrivate ? 'private' : 'public';
  const dash = isPrivate ? 'dashboard-private.html' : 'dashboard.html';
  const draftKey = 'pope_v56_drafts_' + space;
  const stateKey = 'pope_v56_need_state_' + space;
  const $=(s,r=document)=>r.querySelector(s);
  function esc(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function backUrl(){return dash+'?from=app&returnStep=2&attach=last';}
  function patchLinks(){
    ['topbarHomeLink','appHomeLink','btnRetourDashboard'].forEach(id=>{const a=document.getElementById(id); if(a) a.href=backUrl();});
    let btn=document.getElementById('v56ReturnJourney');
    if(!btn){btn=document.createElement('a');btn.id='v56ReturnJourney';btn.className='v56-return-journey';btn.href=backUrl();btn.textContent='← Retour au parcours et joindre ce draft'; const host=document.querySelector('.v36-workflow-bar')||document.querySelector('main')||document.body; host.insertAdjacentElement('afterend',btn);}
    btn.href=backUrl();
  }
  function saveDraft(){
    const out=document.getElementById('output'); const text=(out?.dataset?.raw || out?.innerText || '').trim();
    if(!text || text.length<20 || /^Cliquez|^Erreur/i.test(text)) return null;
    const use=$('#usecase')?.selectedOptions?.[0]?.textContent || 'Draft';
    let state={}; try{state=JSON.parse(localStorage.getItem(stateKey)||'{}')}catch(e){}
    let arr=[]; try{arr=JSON.parse(localStorage.getItem(draftKey)||'[]')}catch(e){}
    const id='draft_'+Date.now();
    const item={id,space,title:(state.title||use||'Draft POPE Online'),usecaseLabel:use,createdAt:new Date().toISOString(),result:text,needState:state};
    const last=arr[arr.length-1]; if(last && last.result===text){sessionStorage.setItem('pope_v56_last_draft_id',last.id); return last;}
    arr.push(item); if(arr.length>50) arr=arr.slice(-50); localStorage.setItem(draftKey,JSON.stringify(arr)); sessionStorage.setItem('pope_v56_last_draft_id',id); patchLinks(); return item;
  }
  function observeOutput(){
    const out=document.getElementById('output'); if(!out) return;
    let timer=null; const mo=new MutationObserver(()=>{clearTimeout(timer); timer=setTimeout(saveDraft,500);}); mo.observe(out,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-raw']});
    const gen=document.getElementById('btnGenerate'); if(gen) gen.addEventListener('click',()=>setTimeout(saveDraft,2500));
    const arch=document.getElementById('btnArchiveCurrent'); if(arch) arch.addEventListener('click',()=>setTimeout(saveDraft,300));
  }
  function installCss(){ if($('#v56AppCss')) return; const st=document.createElement('style'); st.id='v56AppCss'; st.textContent='.v56-return-journey{display:inline-flex;margin:12px auto 0;max-width:980px;align-items:center;gap:8px;background:#f0f7ff;border:1.5px solid #b9d8f1;border-radius:12px;padding:10px 16px;color:#0b5e96;font-weight:800;text-decoration:none}.v40-topbar-nav a[href*="expert"],.v40-topbar-nav a[href*="mission"],#v40MobileMenu a[href*="expert"],#v40MobileMenu a[href*="mission"]{display:none!important}'; document.head.appendChild(st); }
  function init(){installCss();patchLinks();observeOutput();setInterval(saveDraft,4000);} if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init); else init();
})();
