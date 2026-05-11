
function setWorkflowStep(n) {
  ['wfStep1','wfStep2','wfStep3'].forEach(function(id,i) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('active','done');
    if (i+1 === n) el.classList.add('active');
    else if (i+1 < n) el.classList.add('done');
  });
}
window.setWorkflowStep = setWorkflowStep;
// Step 2 au clic sur générer
document.addEventListener('DOMContentLoaded', function() {
  var btn = document.getElementById('btnGenerate');
  if (btn) btn.addEventListener('click', function() { setWorkflowStep(2); }, true);
});
