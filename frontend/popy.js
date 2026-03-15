
(function(){
  const widget = document.getElementById("popyWidget");
  if(!widget) return;
  const launcher = widget.querySelector(".popy-launcher");
  const panel = widget.querySelector(".popy-panel");
  const closeBtn = widget.querySelector(".popy-close");
  const form = widget.querySelector(".popy-form");
  const input = widget.querySelector(".popy-input");
  const messages = widget.querySelector(".popy-messages");
  const chips = widget.querySelectorAll(".popy-chip");
  const backdrop = document.getElementById("popyBackdrop");

  function openPopy(){
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    backdrop && backdrop.classList.add("is-open");
    if(input) input.focus();
  }
  function closePopy(){
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    backdrop && backdrop.classList.remove("is-open");
  }
  function addMessage(text, role){
    const div=document.createElement("div");
    div.className=`popy-msg ${role||"bot"}`;
    div.innerHTML=text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
  function replyFor(userText){
    const text=(userText||"").toLowerCase().trim();
    if(text.includes("privé") || text.includes("prive") || text.includes("artisan") || text.includes("tpe")){
      return {answer:`Je peux vous orienter vers l’univers <strong>privé</strong>. C’est l’espace prévu pour les artisans, TPE, indépendants et commerçants.`, actions:[{label:"Aller vers le privé", href:"private.html"}]};
    }
    if(text.includes("public") || text.includes("collectivité") || text.includes("collectivite") || text.includes("administration")){
      return {answer:`Je peux vous rediriger vers l’univers <strong>public</strong>, conçu pour les collectivités, établissements et organisations publiques.`, actions:[{label:"Aller vers le public", href:"public.html"}]};
    }
    if(text.includes("compte") || text.includes("inscrire") || text.includes("inscription") || text.includes("créer") || text.includes("creer")){
      return {answer:`Pour commencer, vous pouvez créer un compte en quelques clics.`, actions:[{label:"Créer un compte", href:"signup.html"},{label:"Se connecter", href:"login.html"}]};
    }
    if(text.includes("tarif") || text.includes("prix") || text.includes("offre")){
      return {answer:`Je peux vous orienter vers les offres et la tarification de POPE Online.`, actions:[{label:"Voir les offres", href:"pricing.html"}]};
    }
    if(text.includes("expert")){
      return {answer:`L’offre <strong>POPE Expert</strong> permet une validation humaine et un appui plus sécurisé.`, actions:[{label:"POPE Expert", href:"expert.html"}]};
    }
    if(text.includes("mission") || text.includes("sur mesure")){
      return {answer:`Si votre besoin est plus complet, je peux vous orienter vers une <strong>mission sur mesure</strong>.`, actions:[{label:"Décrire une mission", href:"mission.html"}]};
    }
    if(text.includes("contact") || text.includes("mail") || text.includes("telephone") || text.includes("téléphone")){
      return {answer:`Vous pouvez prendre contact de plusieurs façons selon votre préférence.`, actions:[{label:"Contacter POPE Online", href:"private.html#contact"}]};
    }
    if(text.includes("bonjour") || text.includes("salut")){
      return {answer:`Bonjour. Je peux vous aider à trouver le bon espace, une offre, la connexion, ou la prise de contact.`};
    }
    return {answer:`Je peux vous aider à naviguer sur POPE Online. Essayez par exemple : <strong>privé</strong>, <strong>public</strong>, <strong>offres</strong>, <strong>créer un compte</strong> ou <strong>contact</strong>.`};
  }
  function renderBotReply(result){
    let html = `<div>${result.answer}</div>`;
    if(result.actions && result.actions.length){
      html += `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">${result.actions.map(action => `<a href="${action.href}" style="display:inline-flex;align-items:center;padding:8px 12px;border-radius:999px;text-decoration:none;background:rgba(244,157,70,.10);color:#9a5a12;border:1px solid rgba(244,157,70,.25);font-weight:700;">${action.label}</a>`).join("")}</div>`;
    }
    addMessage(html, "bot");
  }
  function handleUserMessage(text){
    if(!text) return;
    addMessage(text, "user");
    const result = replyFor(text);
    setTimeout(() => renderBotReply(result), 260);
  }
  launcher && launcher.addEventListener("click", function(){
    if(panel.classList.contains("is-open")) closePopy(); else openPopy();
  });
  closeBtn && closeBtn.addEventListener("click", closePopy);
  backdrop && backdrop.addEventListener("click", closePopy);
  form && form.addEventListener("submit", function(e){
    e.preventDefault();
    const text=input.value.trim();
    if(!text) return;
    handleUserMessage(text);
    input.value="";
  });
  chips.forEach(chip => chip.addEventListener("click", function(){ handleUserMessage(chip.dataset.prompt || chip.textContent.trim()); }));
})();
