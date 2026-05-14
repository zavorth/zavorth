import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/zavorth',
    'X-Title': 'Zavorth Direct Test',
  },
});

async function testMinimax() {
  const prompt = process.argv[2] || 'Olá Minimax!';
  const outputFile = process.argv[3]; // Caminho opcional para salvar o HTML extraído
  const model = 'minimax/minimax-m2.7';

  console.error(`🚀 Enviando prompt para ${model}...`);
  console.error(`📝 Prompt: "${prompt.substring(0, 80)}..."\n`);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: parseInt(process.env.MAX_TOKENS || '8000', 10),
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      console.error('⚠️ O modelo não retornou conteúdo.');
      process.exit(1);
    }

    // Extrair HTML de dentro do bloco ```html ... ```
    const htmlMatch = content.match(/```html\s*([\s\S]*?)```/);
    const htmlContent = htmlMatch ? htmlMatch[1].trim() : content.trim();

    // Se tiver arquivo de saída, salvar lá
    if (outputFile) {
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
      fs.writeFileSync(outputFile, htmlContent, 'utf8');
      console.error(`✅ HTML salvo em: ${outputFile}`);
      console.error(`📊 Tamanho: ${htmlContent.length} caracteres, ~${htmlContent.split('\n').length} linhas`);
      
      // Verificar se o HTML está completo
      const hasClosingHtml = htmlContent.includes('</html>');
      const hasClosingBody = htmlContent.includes('</body>');
      if (!hasClosingHtml || !hasClosingBody) {
        console.error('⚠️ AVISO: O HTML parece INCOMPLETO (faltam tags de fechamento).');
      } else {
        console.error('✅ HTML COMPLETO verificado (</body> e </html> presentes).');
      }
    } else {
      // Sem arquivo de saída, imprimir no stdout
      console.log(htmlContent);
    }

  } catch (error: any) {
    console.error('❌ ERRO:', error?.message || error);
    process.exit(1);
  }
}

testMinimax();
