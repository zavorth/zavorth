import { extractFunctionBody } from './ZavorthControlClassicScriptUtils.js';
import type { Snippet } from '../../../../services/SnippetService.js';

declare function showToast(msg: string, isError?: boolean): void;

function zavorthControlClassicClientDataSnippets() {
    let currentSnippets: Snippet[] = [];

    async function loadSnippets() {
      try {
         const res = await fetch('/api/snippets');
         const { snippets } = await res.json() as { snippets: Snippet[] };
         currentSnippets = snippets;
         renderSnippetList();
      } catch (_e) { console.warn("[auto-fix] Empty catch block", _e); }
    }

    function renderSnippetList() {
      const c = document.getElementById('snippet-list-container') as HTMLElement | null;
      if (!c) return;
      if(currentSnippets.length === 0) {
        c.innerHTML = '<div style="color:#9fb0c3">Sem snippets salvos.</div>';
        return;
      }
      c.innerHTML = currentSnippets.map((s) => `
        <div class="snippet-item" onclick="selectSnippet('${s.name}')">
          <span>${s.name}</span>
        </div>
      `).join('');
    }

    function newSnippet() {
      const nameEl = document.getElementById('snippet-name') as HTMLInputElement | null;
      const contentEl = document.getElementById('snippet-content') as HTMLInputElement | null;
      const delBtn = document.getElementById('snippet-btn-del');
      if (nameEl) { nameEl.value = ''; nameEl.disabled = false; }
      if (contentEl) contentEl.value = '';
      if (delBtn) delBtn.style.display = 'none';
      document.querySelectorAll('.snippet-item').forEach((e) => e.classList.remove('active'));
    }

    function selectSnippet(name: string) {
      const snip = currentSnippets.find((s) => s.name === name);
      if(!snip) return;
      document.querySelectorAll('.snippet-item').forEach((e) => {
         if((e as HTMLElement).innerText.trim() === name) e.classList.add('active');
         else e.classList.remove('active');
      });
      const nameEl = document.getElementById('snippet-name') as HTMLInputElement | null;
      const contentEl = document.getElementById('snippet-content') as HTMLInputElement | null;
      if (nameEl) { nameEl.value = snip.name; nameEl.disabled = true; }
      if (contentEl) contentEl.value = snip.content;
      document.getElementById('snippet-btn-del')?.style.setProperty('display', 'block');
    }

    async function saveSnippet() {
       const nameEl = document.getElementById('snippet-name') as HTMLInputElement | null;
       const contentEl = document.getElementById('snippet-content') as HTMLInputElement | null;
       const name = nameEl?.value || '';
       const content = contentEl?.value || '';
       if(!name || !content) return showToast('Preencha nome e conteudo.', true);
       try {
         const res = await fetch('/api/snippets/save', {
           method: 'POST', body: JSON.stringify({ name, content })
         });
         const data = await res.json();
         if(data.ok) { showToast('Snippet Salvo!'); loadSnippets(); }
         else showToast(data.error, true);
       } catch(_e) { showToast('Erro de rede', true); }
    }

    async function deleteSnippet() {
       const nameEl = document.getElementById('snippet-name') as HTMLInputElement | null;
       const name = nameEl?.value || '';
       if(!name) return;
       if(!confirm('Deletar snippet ' + name + '?')) return;
       try {
         const res = await fetch('/api/snippets/delete', {
           method: 'POST', body: JSON.stringify({ name })
         });
         const data = await res.json();
         if(data.ok) { showToast('Deletado!'); newSnippet(); loadSnippets(); }
         else showToast(data.error, true);
       } catch(_e) { showToast('Erro de rede', true); }
    }
}

export function getZavorthControlClassicClientDataSnippetsScript(): string {
  return extractFunctionBody(zavorthControlClassicClientDataSnippets);
}

