/* POPE Online V61 — state manager robuste dashboard ↔ app */
(function(window){
  'use strict';
  var path = (window.location.pathname || '').toLowerCase();
  var isPrivate = path.indexOf('private') !== -1;
  var space = isPrivate ? 'private' : 'public';
  var KEY = 'pope_need_state_v61_' + space;
  var CANON = 'pope_need_state_' + space;
  var LEGACY = [CANON, 'pope_v60_state_'+space, 'pope_v58_state_'+space, 'pope_v57_state_'+space];
  var GEN_KEY = 'pope_generations_v61_' + space;
  var LEGACY_GEN = ['pope_v54_generations','pope_v53_generations'];
  function safeParse(raw, fallback){ try { return raw ? JSON.parse(raw) : fallback; } catch(e){ return fallback; } }
  function readRaw(k){ return sessionStorage.getItem(k) || localStorage.getItem(k); }
  function defaultState(){ return {version:'v61', space:space, step:1, domain:'', domainIcon:'🎯', need:{}, drafts:[], selectedDraft:null, documents:[], scrollY:0, updatedAt:new Date().toISOString()}; }
  function normalize(s){
    s = s || defaultState();
    if(!s.need) s.need = {};
    if(!s.drafts) s.drafts = [];
    if(!s.documents) s.documents = [];
    if(!s.space) s.space = space;
    if(!s.version) s.version = 'v61';
    return s;
  }
  function load(){
    var raw = readRaw(KEY) || readRaw(CANON);
    if(!raw){ for(var i=0;i<LEGACY.length;i++){ raw = readRaw(LEGACY[i]); if(raw) break; } }
    return normalize(safeParse(raw, defaultState()));
  }
  function save(patch){
    var current = load();
    var next = Object.assign({}, current, patch || {});
    next.need = Object.assign({}, current.need || {}, (patch && patch.need) || {});
    next.updatedAt = new Date().toISOString();
    var json = JSON.stringify(next);
    try { sessionStorage.setItem(KEY, json); localStorage.setItem(KEY, json); localStorage.setItem(CANON, json); } catch(e){}
    LEGACY.forEach(function(k){ try { localStorage.setItem(k, json); } catch(e){} });
    return next;
  }
  function clear(){ [KEY,CANON].concat(LEGACY).forEach(function(k){ try{ sessionStorage.removeItem(k); localStorage.removeItem(k); }catch(e){} }); }
  function loadGenerations(){
    var all = [];
    function add(arr){ (arr||[]).forEach(function(g){ if(g && !all.some(function(x){return x.id===g.id;})) all.push(g); }); }
    add(safeParse(localStorage.getItem(GEN_KEY), []));
    LEGACY_GEN.forEach(function(k){ add(safeParse(localStorage.getItem(k), [])); });
    return all.sort(function(a,b){ return new Date(b.createdAt||0) - new Date(a.createdAt||0); });
  }
  function saveGeneration(entry){
    var st = load();
    var g = Object.assign({}, entry || {});
    g.id = g.id || ('gen_' + Date.now());
    g.title = g.title || g.usecaseLabel || st.need.title || 'Draft préparé';
    g.usecaseLabel = g.usecaseLabel || g.title;
    g.createdAt = g.createdAt || new Date().toISOString();
    g.domain = g.domain || st.domain || '';
    g.space = g.space || space;
    g.result = g.result || g.output || '';
    g.prompt = g.prompt || { context: st.need.context || st.need.description || '', objective: st.need.objective || st.need.title || '' };
    var arr = loadGenerations().filter(function(x){ return x.id !== g.id; });
    arr.unshift(g); arr = arr.slice(0,30);
    try { localStorage.setItem(GEN_KEY, JSON.stringify(arr)); localStorage.setItem('pope_v54_generations', JSON.stringify(arr)); localStorage.setItem('pope_v53_generations', JSON.stringify(arr)); sessionStorage.setItem('pope_v61_last_gen', g.id); sessionStorage.setItem('pope_v58_last_gen', g.id); sessionStorage.setItem('pope_v54_last_generation_id', g.id); sessionStorage.setItem('pope_v53_last_generation_id', g.id); } catch(e){}
    save({drafts:arr, selectedDraft:g.id});
    return g;
  }
  function lastGenId(){ var arr=loadGenerations(); return sessionStorage.getItem('pope_v61_last_gen') || sessionStorage.getItem('pope_v58_last_gen') || sessionStorage.getItem('pope_v54_last_generation_id') || (arr[0] && arr[0].id) || ''; }
  function dashUrl(step, attach){ return (isPrivate?'dashboard-private.html':'dashboard.html') + '?from=app&step=' + (step||2) + (attach?'&attach=last':''); }
  function appUrl(){ return (isPrivate?'app-private.html':'app.html') + '?from=dashboard&step=2'; }
  window.POPEV61State = {KEY:KEY, space:space, isPrivate:isPrivate, load:load, save:save, clear:clear, loadGenerations:loadGenerations, saveGeneration:saveGeneration, lastGenId:lastGenId, dashUrl:dashUrl, appUrl:appUrl};
})(window);
