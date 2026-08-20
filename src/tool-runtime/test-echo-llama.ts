import { LocalLlamaProvider } from '../providers/LocalLlamaProvider';
import { ZavorthEchoOrchestrator } from './orchestrator/ZavorthEchoOrchestrator';
import { ChatMessage } from '../providers/ILlmProvider';
import { asErrorLike } from '../utils/errorLike.js';

async function runTest() {
    console.log('=== Starting manual test: llama.cpp + Zavorth Echo ===\n');

    const provider = new LocalLlamaProvider({
        baseUrl: 'http://localhost:11434/v1',
        modelName: 'gemma2:2b',
    });

    const orchestrator = new ZavorthEchoOrchestrator();

    const osTools = orchestrator.getSchemasForCategory('OS');
    console.log(`[SYSTEM]: ${osTools.length} OS tool(s) registered.`);
    console.log('[SCHEMAS]:', JSON.stringify(osTools, null, 2));

    const userPrompt = 'Open the browser at https://google.com';
    console.log(`\n[USER]: ${userPrompt}`);
    console.log(`[SYSTEM]: Extracting intent and sending it to the local LLM (${provider.name})...\n`);

    const messages: ChatMessage[] = [
        {
            role: 'system',
            content: 'You are Zavorth Echo, an intelligent assistant. Analyze the user request and call tools when useful.',
        },
        { role: 'user', content: userPrompt },
    ];

    try {
        const response = await provider.chat(messages, osTools);

        console.log(`[LLM RESPONSE]: ${response.content || '(Empty ? focused on tool use)'}`);
        console.log('[TOOL CALLS DETECTED]:', JSON.stringify(response.toolCalls, null, 2));

        if (response.toolCalls && response.toolCalls.length > 0) {
            for (const toolCall of response.toolCalls) {
                console.log(`\n[ECHO]: Passing tool call '${toolCall.name}' to the security engine...`);

                const executionLog = await orchestrator.executePipeline(
                    userPrompt,
                    toolCall.name,
                    toolCall.arguments,
                );

                console.log('[ECHO RESULT]:', executionLog);
            }
        } else {
            console.log('\nThe LLM responded directly and did not invoke any tool.');
        }

        console.log('\n[EXECUTION LOG]:', JSON.stringify(orchestrator.getExecutionLog(), null, 2));
    } catch (error: unknown) {
      const err = asErrorLike(error);
      console.error('\n[X] Test failed:');
        if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
            console.error('  -> The local Llama/Ollama server is not running.');
            console.error('  -> Make sure Ollama is open or the local llama.cpp server / LM Studio is on port 11434/8080.');
        } else {
            console.error(error);
        }
    }
}

runTest();
