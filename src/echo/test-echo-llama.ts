import { LocalLlamaProvider } from '../providers/LocalLlamaProvider';
import { ZavorthEchoOrchestrator } from './orchestrator/ZavorthEchoOrchestrator';
import { ChatMessage } from '../providers/ILlmProvider';

async function runTest() {
    console.log("=== Iniciando Teste Manual: Llama.cpp + Zavorth Echo ===\n");

    // 1. Instanciar o Provider e o Orquestrador
    const provider = new LocalLlamaProvider({
        baseUrl: 'http://localhost:11434/v1', // Mude para http://localhost:8080/v1 se usar o llama-server nativo
        modelName: 'gemma2:2b' // Configurado para a menor versão estável disponível (Gemma 2 2B)
    });

    const orchestrator = new ZavorthEchoOrchestrator();

    // 2. Coletar Schemas para injetar (agora usando ToolSchemaHelper genérico)
    const osTools = orchestrator.getSchemasForCategory('OS');
    console.log(`[SYSTEM]: ${osTools.length} ferramenta(s) OS registrada(s).`);
    console.log(`[SCHEMAS]:`, JSON.stringify(osTools, null, 2));
    
    // 3. Simular Prompt do Usuário
    const userPrompt = "Abra o navegador no site https://google.com";
    console.log(`\n[USER]: ${userPrompt}`);
    console.log(`[SYSTEM]: Extraindo intenção... enviando para o LLM Local (${provider.name})...\n`);

    const messages: ChatMessage[] = [
        { role: 'system', content: 'Você é o Zavorth Echo, um assistente inteligente. Analise o que o usuário pedir e sinta-se à vontade para chamar ferramentas.' },
        { role: 'user', content: userPrompt }
    ];

    try {
        // 4. Bater no LLM local
        const response = await provider.chat(messages, osTools);

        console.log(`[LLM RESPONSE]: ${response.content || '(Vazio - Focou na Tool)'}`);
        console.log(`[TOOL CALLS DETECTADOS]:`, JSON.stringify(response.toolCalls, null, 2));

        // 5. Executar as ferramentas capturadas
        if (response.toolCalls && response.toolCalls.length > 0) {
            for (const toolCall of response.toolCalls) {
                console.log(`\n[ECHO]: Passando Tool Call '${toolCall.name}' para o Security Engine...`);
                
                const executionLog = await orchestrator.executePipeline(
                    userPrompt,
                    toolCall.name,
                    toolCall.arguments
                );

                console.log(`[ECHO RESULT]: ${executionLog}`);
            }
        } else {
            console.log("\nO LLM respondeu diretamente, mas não invocou nenhuma ferramenta.");
        }

        // 6. Exibir histórico de execuções
        console.log(`\n[EXECUTION LOG]:`, JSON.stringify(orchestrator.getExecutionLog(), null, 2));

    } catch (error: any) {
        console.error("\n[X] Falha no Teste:");
        if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
            console.error("  -> O servidor local do Llama/Ollama não está rodando!");
            console.error("  -> Certifique-se de que o Ollama está aberto ou o llama.cpp local (LM Studio) está na porta 11434/8080.");
        } else {
            console.error(error);
        }
    }
}

runTest();
