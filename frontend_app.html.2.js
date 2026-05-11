
(function(){
  function hasSession(){
    return localStorage.getItem('pope_session_active')==='1'||
           !!sessionStorage.getItem('pope_session_token')||
           !!localStorage.getItem('pope_session_token');
  }
  function getToken(){
    return sessionStorage.getItem('pope_session_token')||
           localStorage.getItem('pope_session_token')||'';
  }
  function getApiBase(){
    var e=window.__POPE_API_BASE__||'';
    if(e) return String(e).replace(/\/$/,'');
    var h=window.location.hostname;
    if(h==='localhost'||h==='127.0.0.1') return 'http://localhost:3000';
    return 'https://pope-online-v2.onrender.com';
  }
  function redirectToLogin(){
    var path=encodeURIComponent((window.location.pathname||'')+(window.location.search||'')||'dashboard.html');
    window.location.replace('login.html?next='+path);
  }
  var protected=['app.html','dashboard.html','dashboard-private.html','expert.html',
    'mission.html','private-onboarding.html','account.html','profile.html',
    'dashboard-admin.html','vault.html','app-private.html','expert-private.html',
    'mission-private.html','referral.html','tutoriel.html'];
  var path=(window.location.pathname||'').toLowerCase();
  var isProtected=protected.some(function(f){return path.endsWith('/'+f)||path.endsWith(f);});
  if(!isProtected) return;
  if(hasSession()){window.__popeAuthValidated=true;return;}
  window.__popeAuthPending=true;
  var headers={'Content-Type':'application/json'};
  var token=getToken();
  if(token) headers['Authorization']='Bearer '+token;
  fetch(getApiBase()+'/auth/me',{method:'GET',credentials:'include',headers:headers})
    .then(function(res){
      if(!res.ok) throw new Error('HTTP '+res.status);
      return res.json().catch(function(){return {};});
    })
    .then(function(data){
      if(data&&data.user){
        localStorage.setItem('pope_session_active','1');
        localStorage.setItem('pope_session_user',JSON.stringify(data.user));
        if(data.user.accountSpace) localStorage.setItem('pope_account_space',data.user.accountSpace);
        window.__popeAuthValidated=true;
      } else throw new Error('missing_user');
    })
    .catch(function(){
      window.__popeAuthValidated=false;
      redirectToLogin();
    })
    .finally(function(){window.__popeAuthPending=false;});
})();
