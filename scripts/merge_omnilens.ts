import fs from 'fs';
import path from 'path';
import { asErrorLike } from '../src/utils/errorLike';

const file1 = path.join(process.cwd(), 'scripts', 'out_omnilens_final_utf8.html');
const file2 = path.join(process.cwd(), 'scripts', 'out_omnilens_part2_utf8.html');
const target = path.resolve(process.cwd(), '..', 'minimax-omnilens-m27', 'index.html');

try {
  let content1 = fs.readFileSync(file1, 'utf8');
  let content2 = fs.readFileSync(file2, 'utf8');

  // Extrair o conteúdo dentro dos blocos ```html
  const extract = (text: string) => {
    const match = text.match(/```html([\s\S]*?)```/);
    return match ? match[1] : text;
  };

  let html1 = extract(content1);
  let html2 = extract(content2);

  // Limpar a junção (remover o final cortado da parte 1)
  html1 = html1.substring(0, html1.lastIndexOf('.form-select {'));

  // Combinar (a parte 2 já começa do .form-select)
  let fullHtml = html1 + html2;

  // Fechar o que ficou aberto (o part2 parou no footer grid)
  if (!fullHtml.includes('</html>')) {
      fullHtml += '\n            </div>\n        </div>\n    </footer>\n</body>\n</html>';
  }

  fs.writeFileSync(target, fullHtml, 'utf8');
  console.log(`✅ Arquivo unificado com sucesso em: ${target}`);
} catch (error: unknown) { const err = asErrorLike(error); const e = err; console.error(`❌ Erro ao unificar: ${e.message}`);
}
