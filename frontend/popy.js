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
    if(!panel) return;
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    widget.classList.add("is-open");
    backdrop && backdrop.classList.add("is-open");
    if(input) input.focus();
  }
  function closePopy(){
    if(!panel) return;
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    widget.classList.remove("is-open");
    backdrop && backdrop.classList.remove("is-open");
  }
  function addMessage(text, role){
    if(!messages) return;
    const div=document.createElement("div");
    div.className=`popy-msg ${role||"bot"}`;
    div.innerHTML=text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
  function replyFor(userText){
    const text=(userText||"").toLowerCase().trim();
    if(text.includes("privé") || text.includes("prive") || text.includes("artisan") || text.includes("tpe") || text.includes("commer")) {
      return {answer:`Je peux vous orienter vers l’univers <strong>privé</strong>, prévu pour les artisans, indépendants, TPE, commerçants et petites structures.`, actions:[{label:"Aller vers le privé", href:"private.html"},{label:"🎁 Offre gratuite", href:"signup.html"}]};
    }
    if(text.includes("public") || text.includes("collectivité") || text.includes("collectivite") || text.includes("administration") || text.includes("dgs")) {
      return {answer:`Je peux vous rediriger vers l’univers <strong>public</strong>, conçu pour les collectivités, établissements et organisations.`, actions:[{label:"Aller vers le public", href:"public.html"},{label:"🎁 Offre gratuite", href:"signup.html"}]};
    }
    if(text.includes("gratuit") || text.includes("cadeau") || text.includes("offre")) {
      return {answer:`Vous pouvez démarrer avec l’<strong>offre gratuite</strong> en créant votre compte.`, actions:[{label:"Créer un compte", href:"signup.html"}]};
    }
    if(text.includes("compte") || text.includes("inscrire") || text.includes("inscription") || text.includes("créer") || text.includes("creer")){
      return {answer:`Pour commencer, vous pouvez créer un compte en quelques clics.`, actions:[{label:"Créer un compte", href:"signup.html"},{label:"Se connecter", href:"login.html"}]};
    }
    if(text.includes("expert") || text.includes("relecture")){
      return {answer:`La <strong>relecture experte</strong> permet une consolidation et une sécurisation plus poussées.`, actions:[{label:"Relecture experte", href:"expert.html"}]};
    }
    if(text.includes("mission") || text.includes("sur mesure") || text.includes("accompagnement")){
      return {answer:`Si votre besoin est plus complet, je peux vous orienter vers un <strong>accompagnement sur mesure</strong>.`, actions:[{label:"Accompagnement sur mesure", href:"mission.html"}]};
    }
    if(text.includes("produire") || text.includes("livrable") || text.includes("génération") || text.includes("generation")){
      return {answer:`Le module de <strong>génération guidée</strong> vous aide à produire un livrable sécurisé.`, actions:[{label:"Produire un livrable sécurisé", href:"app.html"}]};
    }
    if(text.includes("contact") || text.includes("mail") || text.includes("telephone") || text.includes("téléphone")){
      return {answer:`Je peux vous orienter vers la page la plus adaptée pour être recontacté.`, actions:[{label:"Contact privé", href:"private.html#contact"},{label:"Contact public", href:"public.html#contact"}]};
    }
    if(text.includes("bonjour") || text.includes("salut")){
      return {answer:`Bonjour. Je peux vous aider à trouver le bon espace, créer un compte, démarrer l’offre gratuite ou qualifier votre besoin.`};
    }
    return {answer:`Je peux vous aider à naviguer sur POPE Online. Essayez par exemple : <strong>privé</strong>, <strong>public</strong>, <strong>offre gratuite</strong>, <strong>produire un livrable</strong> ou <strong>contact</strong>.`};
  }
  function renderBotReply(result){
    let html = `<div>${result.answer}</div>`;
    if(result.actions && result.actions.length){
      html += `<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">${result.actions.map(action => `<a class="popy-chip-link" href="${action.href}">${action.label}</a>`).join("")}</div>`;
    }
    addMessage(html, "bot");
  }
  launcher && launcher.addEventListener("click", openPopy);
  closeBtn && closeBtn.addEventListener("click", closePopy);
  backdrop && backdrop.addEventListener("click", closePopy);

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const text = chip.dataset.prompt || chip.textContent;
      addMessage(text, "user");
      renderBotReply(replyFor(text));
    });
  });

  form && form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if(!text) return;
    addMessage(text, "user");
    input.value = "";
    renderBotReply(replyFor(text));
  });
})();