// @ts-nocheck
import { extractFunctionBody } from './DashboardClassicScriptUtils.js';

function dashboardClassicClientDataSnippets() {
    let currentSnippets = [];

    async function loadSnippets() {
      try {
         const res = await fetch('/api/snippets');
         const { snippets } = await res.json();
         currentSnippets = snippets;
         renderSnippetList();
      } catch(e) {}
    }

    function renderSnippetList() {
      const c = document.getElementById('snippet-list-container');
      if(currentSnippets.length === 0) {
        c.innerHTML = '<div style="color:#9fb0c3">Sem snippets salvos.</div>';
        return;
      }
      c.innerHTML = currentSnippets.map(s => `
        <div class="snippet-item" onclick="selectSnippet('${s.name}')">
          <span>${s.name}</span>
        </div>
      `).join('');
    }

    function newSnippet() {
      document.getElementById('snippet-name').value = '';
      document.getElementById('snippet-name').disabled = false;
      document.getElementById('snippet-content').value = '';
      document.getElementById('snippet-btn-del').style.display = 'none';
      document.querySelectorAll('.snippet-item').forEach(e => e.classList.remove('active'));
    }

    function selectSnippet(name) {
      const snip = currentSnippets.find(s => s.name === name);
      if(!snip) return;
      document.querySelectorAll('.snippet-item').forEach(e => {
         if(e.innerText.trim() === name) e.classList.add('active');
         else e.classList.remove('active');
      });
      document.getElementById('snippet-name').value = snip.name;
      document.getElementById('snippet-name').disabled = true;
      document.getElementById('snippet-content').value = snip.content;
      document.getElementById('snippet-btn-del').style.display = 'block';
    }

    async function saveSnippet() {
       const name = document.getElementById('snippet-name').value;
       const content = document.getElementById('snippet-content').value;
       if(!name || !content) return showToast('Preencha nome e conteudo.', true);
       try {
         const res = await fetch('/api/snippets/save', {
           method: 'POST', body: JSON.stringify({ name, content })
         });
         const data = await res.json();
         if(data.ok) { showToast('Snippet Salvo!'); loadSnippets(); }
         else showToast(data.error, true);
       } catch(e) { showToast('Erro de rede', true); }
    }

    async function deleteSnippet() {
       const name = document.getElementById('snippet-name').value;
       if(!name) return;
       if(!confirm('Deletar snippet ' + name + '?')) return;
       try {
         const res = await fetch('/api/snippets/delete', {
           method: 'POST', body: JSON.stringify({ name })
         });
         const data = await res.json();
         if(data.ok) { showToast('Deletado!'); newSnippet(); loadSnippets(); }
         else showToast(data.error, true);
       } catch(e) { showToast('Erro de rede', true); }
    }
}

export function getDashboardClassicClientDataSnippetsScript(): string {
  return extractFunctionBody(dashboardClassicClientDataSnippets);
}

