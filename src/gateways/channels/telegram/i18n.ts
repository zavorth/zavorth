/**
 * Lightweight i18n for Telegram bot strings.
 * Default language is English. Override with ZAVORTH_LANG env var.
 *
 * Usage:
 *   import { t } from '../../../gateways/channels/telegram/i18n.js';
 *   await ctx.reply(t('auth.access_restricted'));
 *
 * NLU patterns:
 *   import { getNluPatterns } from '../../../gateways/channels/telegram/i18n.js';
 *   const patterns = getNluPatterns();
 *   if (patterns.remoteActivate.test(normalized)) { ... }
 */

type MessageKey = keyof typeof messages.en;

const messages = {
  en: {
    'auth.access_restricted': '⛔ **Access Restricted:**\n\nAs a vice-owner, you do not have permission to use this system/computer command. You have access to research, memory, conversations, and analysis.',
    'auth.host_readonly': 'New host detected. Zavorth entered read-only mode until re-authorization.\nUse `/hostauth status` to inspect and `/hostauth trust` on the current host to enable execution.',
    'auth.unauthorized_group_admin': 'Only group administrators can use this command.',
    'auth.unauthorized_sarcasm_1': "Who gave you permission to talk to me, mortal? Try `/roll` if you want to play.",
    'auth.unauthorized_sarcasm_2': "Admin commands don't work for you. Use `/8ball`.",
    'auth.unauthorized_sarcasm_3': "I only serve my Master. For you, I'm just a game bot. Try `/joke`.",

    'scheduler.report_scheduled': 'Recurring report scheduled.',
    'scheduler.report_blocked': 'Report blocked.',
    'scheduler.task_scheduled': 'Scheduled task',
    'scheduler.task_list_empty': 'Scheduled tasks',
    'scheduler.task_list': 'Scheduled tasks',
    'scheduler.removal': 'Schedule removal',
    'scheduler.id_required': 'Enter the task ID or part of the ID to remove.',
    'scheduler.create_failed': 'Failed to create schedule: {error}',
    'scheduler.report_usage': 'Usage: /report every <Xm|Xh> <topic>\nExample: /report every 6h latest AI news',
    'scheduler.report_format': 'Format: /report every <Xm|Xh> <topic>\nExample: /report every 2h bitcoin price',

    'scheduler.starting': 'The scheduler is still starting...',
    'scheduler.usage': 'Usage: /schedule <every 1h|every 30m> <command>',
    'scheduler.invalid_format': 'Invalid format. Example: /schedule every 1h /cleanup',

    'pipeline.close_help': '- close: ends a blocked or failed workflow',
    'pipeline.missing_step': 'Missing step to restart...',

    'inspection.no_logs': 'No recent logs to show.',

    'pipeline.workflow_usage': 'Use /workflow <type> <objective>.\n\nAvailable workflows:\n- review: executes, reviews and closes with a final assessment\n- ship: implements, reviews and leaves ready for delivery\n- research: researches, synthesizes and returns a clear briefing\n- sdd: runs the next paper of the spec/plan/tasks loop of a feature\n- resume: resumes an existing workflow by run id and, if desired, by a specific stage\n- restart-stage: re-executes a specific stage of an existing workflow\n- close: ends a blocked or failed workflow so it stops appearing as resumable\n\nResume example:\n/workflow resume wf-ship-abc123 review\n/workflow restart-stage wf-ship-abc123 draft',
    'pipeline.missing_workflow_id': 'Missing workflow identifier. Example: /workflow restart-stage wf-ship-abc123 <stage>',
    'pipeline.missing_workflow_id_resume': 'Missing workflow identifier. Example: /workflow resume wf-ship-abc123 [stage]',
    'pipeline.missing_stage': 'Missing stage to restart. Example: /workflow restart-stage wf-ship-abc123 <stage>',
    'pipeline.missing_close_id': 'Missing workflow identifier. Example: /workflow close wf-ship-abc123',
    'pipeline.unknown_workflow': 'Unknown workflow. Use /workflow review, /workflow ship, /workflow research, /workflow sdd, /workflow resume, /workflow restart-stage or /workflow close.',
    'pipeline.missing_objective': 'Missing objective. Example: {example}',
    'pipeline.unknown_workflow_short': 'Unknown workflow. Use review, ship, research or sdd.',
    'pipeline.missing_workflow_objective': 'Missing objective for the {workflow} workflow.',

    'security.lock_password_min': 'The password must be at least 4 characters.\nUsage: /lock set <your_password>',
    'security.lock_success': '🔒 Zavorth locked successfully.\nLocked at: {lockedAt}\n\nAll execution commands are blocked.\nUse /unlock <password> to unlock.',
    'security.lock_error': 'Error locking: {error}',
    'security.not_locked': '🔓 Zavorth is not locked.',
    'security.unlock_usage': 'Usage: /unlock <your_password>',
    'security.unlock_error': 'Error unlocking: {error}',
    'security.wrong_password': '❌ Wrong password.',
    'security.clear_empty': 'No tracked messages to delete.\nNote: I can only delete messages sent since the bot last started.',
    'security.clear_deleting': 'Deleting {count} message(s)...',
    'security.clear_error': 'Error clearing chat: {error}',
    'security.cleanup_error': 'Cleanup error: {error}',
    'security.host_unavailable': 'Host authorization service unavailable in this runtime.',

    'security.deep_clean_started': 'Starting deep system cleanup...',
    'security.no_tracked_messages': 'No tracked messages to delete...',
    'security.password_set': '🔒 Password configured successfully.\nNow use /lock to lock Zavorth.',
    'security.password_required': 'You need to configure a password first...',
    'security.locked': '🔒 Zavorth locked. Use /unlock <password> to unlock.',
    'security.unlocked': '🔓 Zavorth unlocked successfully. All commands reactivated.',

    'output.audio_sent': 'Audio sent successfully.',
    'output.tts_fallback': 'TTS failed, sending as text.',
    'output.no_audio_method': 'No audio sending method available on Telegram.',

    'video.no_subtitle': 'No public subtitle/transcript found for this YouTube video.',
    'video.description_fallback': 'Used only the video description as fallback because there was no public subtitle...',
    'video.no_transcript': 'no transcript',
    'video.transcription_failed': 'Could not transcribe video audio: {error}',
    'video.size_exceeded': 'The video is {size} MB and exceeds the limit...',

    'ytdlp.unavailable': 'yt-dlp is not available to extract audio from this video.',
    'ytdlp.no_audio_file': 'yt-dlp did not produce a usable audio file.',

    'error.broadcast_failed': 'Error sending broadcast: {error}',
    'error.dm_failed': 'Error sending direct message to {chatId}: {error}',
    'error.zavorthControl_failed': 'Failed to start web zavorthControl: {error}',
    'error.startup_timeout': 'Timeout sending pending notification from supervised startup.',

    'video.gemini_skipped_long': 'Skipped native Gemini analysis by URL because the video is {duration} and this path tends to fail on very long videos.',
    'video.no_youtube_id': 'Could not identify the YouTube video ID.',
    'video.description_fallback_full': 'Used only the video description as fallback because there was no public subtitle and no additional extractor succeeded.',
    'video.no_textual_content': 'Could not obtain reliable textual content from this video.',
    'video.no_transcript_or_inline': 'Could not extract transcript or attach an inline version of the video for direct analysis.',

    'ytdlp.provision_warning': 'The optional yt-dlp fallback is not provisioned on this host. {hint}',
    'ytdlp.ffmpeg_warning': 'yt-dlp is present, but the optional ffmpeg was not provisioned. Zavorth will try a lighter path when possible. {hint}',
    'ytdlp.captions_unavailable': 'yt-dlp is not available to fetch external subtitles for this video.',

    'task.file_not_found': 'Could not locate that task. Use /tasks to discover the correct short ID or describe the inspection better.',
    'task.unknown_command': 'Unrecognized command.',
    'task.operator_mode_redirect': 'Direct command recognized. Redirecting to the model switch flow (/agmodel {model})...',

    'mode.operator_activated': 'Operator mode activated.',
    'mode.operator_preparing': 'Now I will prepare the task...',
    'mode.operator_deactivated': 'Operator mode deactivated.',
    'mode.operator_resuming': 'Now Zavorth resumes immediate execution...',
    'mode.operator_status_active': 'Operator mode is active.',
    'mode.operator_status_inactive': 'Operator mode is inactive.',
    'mode.presentation_activated': 'Presentation mode activated.',
    'mode.presentation_deactivated': 'Presentation mode deactivated.',
    'mode.presentation_status_active': 'Presentation mode is active.',
    'mode.presentation_status_inactive': 'Presentation mode is inactive.',

    'media.image_attached': '[Image attached]',
    'media.image_attached_prompt': '[Image attached] Please analyze or describe this image.',
    'media.photo_analysis_failed': 'Could not analyze this photo right now.\n\nReason: {error}',
    'media.path_not_returned': 'Path not returned by Telegram.',
    'media.transcription_unavailable': '[Local transcription unavailable]',
    'media.transcription_unavailable_detail': '[Local transcription unavailable: {error}]',
    'media.transcription_unavailable_fallback': 'local transcription unavailable',
    'media.audio_processing_capability': 'To process this audio I need to enable an optional capability on this host.',
    'media.audio_transcription_failed': 'Could not transcribe this audio right now.\n\nReason: {error}',
    'media.video_processing_capability': 'To prepare this video I need to enable the optional multimedia track.',
    'media.video_processing_failed': 'Could not process this video right now.\n\nReason: {error}',
    'media.unsupported_format': 'For now I can read PDFs, DOCX, ODT, Markdown, TXT files and supported media. If you like, send me one of these formats.',
    'media.document_no_text': 'This document did not produce readable text. Try another file or a document with extractable text.',
    'media.document_truncated': '...[Document truncated to fit the initial analysis. If needed, request segmented reading.]',
    'media.document_prefix': '[Document: {name}]',
    'media.document_reading_capability': 'To read this document I need to enable the optional multimedia track on this host.',
    'media.document_reading_failed': 'Could not read this document right now.\n\nReason: {error}',
    'media.pdf_reader_missing': 'The optional PDF reader is not installed on this host.',
    'media.audio_connectivity_pt': 'Sim, consigo te ouvir corretamente.',
    'media.audio_inconsistent_pt': 'Recebi seu audio, mas a transcricao automatica veio inconsistente. Nao vou inventar conteudo em cima disso. Pode repetir em uma frase curta?',
    'media.audio_connectivity_es': 'Si, puedo escucharte correctamente.',
    'media.audio_inconsistent_es': 'Recibi tu audio, pero la transcripcion automatica fue inconsistente. No voy a inventar contenido. Puedes repetirlo en una frase corta?',
    'media.audio_connectivity_en': 'Yes, I can hear you correctly.',
    'media.audio_inconsistent_en': 'I received your audio, but the automatic transcription looked unreliable. I will not invent content from it. Could you repeat it in one short sentence?',
    'media.safety_detail_pt': 'Detalhe tecnico',
    'media.safety_detail_es': 'Detalle tecnico',
    'media.safety_detail_en': 'Technical detail',
    'media.unknown_error': 'unknown error',

    'selfmod.private_only': '/selfmod can only be used in a private chat with Zavorth.',
    'selfmod.build_mode_required': 'Insufficient operational mode. /selfmod requires BUILD mode.\nCurrent mode: {mode}\n\nUse /mode BUILD to enable.',
    'selfmod.owner_required': 'You can generate proposals with /selfmod, but applying or reverting real changes requires owner/trusted role.',

    'wsl.starting': 'Starting WSL...',
    'wsl.starting_distro': 'Starting WSL on distro {distro}...',
    'wsl.shutting_down': 'Shutting down WSL and freeing RAM...',
    'wsl.access_error': 'Error accessing WSL: {error}',
    'wsl.default_marker': ' (default)',
    'wsl.usage': 'Use /wsl on to start or /wsl off to stop.',

    'zavorthControl.failed_to_start': 'Failed to start ZavorthControl: {error}',
    'zavorthControl.public_url': 'Public URL configured:',
    'zavorthControl.remote_bridge': 'Remote ZavorthBridge for mobile:',
    'zavorthControl.warnings': 'Warnings:',
  },
  pt: {
    'auth.access_restricted': '⛔ **Acesso Restrito:**\n\nComo vice-dono(a), voce nao tem permissao para usar este comando de sistema/computador. Voce tem acesso a pesquisa, memoria, conversas e analises.',
    'auth.host_readonly': 'Host novo detectado. O Zavorth entrou em modo somente leitura ate reautorizacao.\nUse `/hostauth status` para inspecionar e `/hostauth trust` no host atual para liberar execucao.',
    'auth.unauthorized_group_admin': 'Apenas administradores do grupo podem usar este comando.',
    'auth.unauthorized_sarcasm_1': 'Quem te deu permissao para falar comigo, mortal? Tente `/roll` se quiser brincar.',
    'auth.unauthorized_sarcasm_2': 'Comandos de administrador nao funcionam para voce. Use `/8ball`.',
    'auth.unauthorized_sarcasm_3': 'Eu sirvo apenas ao meu Mestre. Para voce, sou apenas um bot de jogos. Tente `/joke`.',

    'scheduler.report_scheduled': 'Relatorio governado agendado.',
    'scheduler.report_blocked': 'Relatorio bloqueado.',
    'scheduler.task_scheduled': 'Tarefas agendadas',
    'scheduler.task_list_empty': 'Tarefas agendadas',
    'scheduler.task_list': 'Tarefas agendadas',
    'scheduler.removal': 'Remocao de agendamento',
    'scheduler.id_required': 'Informe o ID ou pedaco do ID da tarefa para remover.',
    'scheduler.create_failed': 'Falha ao criar agendamento: {error}',
    'scheduler.report_usage': 'Uso: /report every <Xm|Xh> <tema>\nExemplo: /report every 6h ultimas noticias de IA',
    'scheduler.report_format': 'Formato: /report every <Xm|Xh> <tema>\nExemplo: /report every 2h bitcoin price',

    'scheduler.starting': 'O agendador ainda esta iniciando...',
    'scheduler.usage': 'Uso: /schedule <every 1h|every 30m> <comando>',
    'scheduler.invalid_format': 'Formato invalido. Exemplo: /schedule every 1h /cleanup',

    'pipeline.close_help': '- close: encerra um workflow bloqueado ou com falha',
    'pipeline.missing_step': 'Faltou a etapa para reiniciar...',

    'inspection.no_logs': 'Ainda nao ha logs recentes para mostrar.',

    'pipeline.workflow_usage': 'Use /workflow <tipo> <objetivo>.\n\nWorkflows disponiveis:\n- review: executa, revisa e fecha com um parecer final\n- ship: implementa, revisa e deixa pronto para entrega\n- research: pesquisa, sintetiza e devolve um briefing claro\n- sdd: roda o proximo papel do loop spec/plan/tasks de uma feature\n- resume: retoma um workflow existente pelo run id e, se quiser, por uma etapa especifica\n- restart-stage: reexecuta uma etapa especifica de um workflow existente\n- close: encerra um workflow bloqueado ou com falha para ele deixar de aparecer como retomada\n\nExemplo de retomada:\n/workflow resume wf-ship-abc123 review\n/workflow restart-stage wf-ship-abc123 draft',
    'pipeline.missing_workflow_id': 'Faltou o identificador do workflow. Exemplo: /workflow restart-stage wf-ship-abc123 <etapa>',
    'pipeline.missing_workflow_id_resume': 'Faltou o identificador do workflow. Exemplo: /workflow resume wf-ship-abc123 [etapa]',
    'pipeline.missing_stage': 'Faltou a etapa para reiniciar. Exemplo: /workflow restart-stage wf-ship-abc123 <etapa>',
    'pipeline.missing_close_id': 'Faltou o identificador do workflow. Exemplo: /workflow close wf-ship-abc123',
    'pipeline.unknown_workflow': 'Workflow desconhecido. Use /workflow review, /workflow ship, /workflow research, /workflow sdd, /workflow resume, /workflow restart-stage ou /workflow close.',
    'pipeline.missing_objective': 'Faltou o objetivo. Exemplo: {example}',
    'pipeline.unknown_workflow_short': 'Workflow desconhecido. Use review, ship, research ou sdd.',
    'pipeline.missing_workflow_objective': 'Faltou o objetivo para o workflow {workflow}.',

    'security.lock_password_min': 'A senha deve ter pelo menos 4 caracteres.\nUso: /lock set <sua_senha>',
    'security.lock_success': '🔒 Zavorth trancado com sucesso.\nTrancado em: {lockedAt}\n\nTodos os comandos de execucao estao bloqueados.\nUse /unlock <senha> para destrancar.',
    'security.lock_error': 'Erro ao trancar: {error}',
    'security.not_locked': '🔓 O Zavorth nao esta trancado.',
    'security.unlock_usage': 'Use: /unlock <sua_senha>',
    'security.unlock_error': 'Erro ao destrancar: {error}',
    'security.wrong_password': '❌ Senha incorreta.',
    'security.clear_empty': 'Nenhuma mensagem rastreada para apagar.\nNota: so consigo apagar mensagens enviadas desde a ultima vez que o bot iniciou.',
    'security.clear_deleting': 'Apagando {count} mensagem(ns)...',
    'security.clear_error': 'Erro ao limpar chat: {error}',
    'security.cleanup_error': 'Erro na limpeza: {error}',
    'security.host_unavailable': 'Servico de autorizacao de host indisponivel neste runtime.',

    'security.deep_clean_started': 'Iniciando limpeza profunda do sistema...',
    'security.no_tracked_messages': 'Nenhuma mensagem rastreada para apagar...',
    'security.password_set': '🔒 Senha configurada com sucesso.\nAgora use /lock para trancar o Zavorth.',
    'security.password_required': 'Voce precisa configurar uma senha primeiro...',
    'security.locked': '🔒 Zavorth trancado. Use /unlock <senha> para destrancar.',
    'security.unlocked': '🔓 Zavorth destrancado com sucesso. Todos os comandos reativados.',

    'output.audio_sent': 'Audio enviado com sucesso.',
    'output.tts_fallback': 'TTS falhou, enviando como texto.',
    'output.no_audio_method': 'Nenhum metodo de envio de audio disponivel no Telegram.',

    'video.no_subtitle': 'Nao encontrei legenda/transcricao publica neste video do YouTube.',
    'video.description_fallback': 'Usei apenas a descricao do video como fallback porque nao havia legenda publica...',
    'video.no_transcript': 'sem transcricao',
    'video.transcription_failed': 'Nao consegui transcrever o audio do video: {error}',
    'video.size_exceeded': 'O video tem {size} MB e excede o limite...',

    'ytdlp.unavailable': 'yt-dlp nao esta disponivel para extrair audio deste video.',
    'ytdlp.no_audio_file': 'yt-dlp nao gerou um arquivo de audio utilizavel.',

    'error.broadcast_failed': 'Erro ao enviar broadcast: {error}',
    'error.dm_failed': 'Erro ao enviar mensagem direta para {chatId}: {error}',
    'error.zavorthControl_failed': 'Falha ao iniciar zavorthControl web: {error}',
    'error.startup_timeout': 'Timeout ao enviar notificacao pendente do startup supervisionado.',

    'video.gemini_skipped_long': 'Pulei a analise nativa do Gemini por URL porque o video tem {duration} e esse caminho tende a falhar em videos muito longos.',
    'video.no_youtube_id': 'Nao consegui identificar o ID do video do YouTube.',
    'video.description_fallback_full': 'Usei apenas a descricao do video como fallback porque nao havia legenda publica e nenhum extrator adicional teve sucesso.',
    'video.no_textual_content': 'Nao consegui obter um conteudo textual confiavel deste video.',
    'video.no_transcript_or_inline': 'Nao consegui extrair transcricao nem anexar uma versao inline do video para analise direta.',

    'ytdlp.provision_warning': 'O fallback opcional de yt-dlp nao esta provisionado neste host. {hint}',
    'ytdlp.ffmpeg_warning': 'O yt-dlp esta presente, mas o ffmpeg opcional nao foi provisionado. O Zavorth vai tentar um caminho mais leve quando possivel. {hint}',
    'ytdlp.captions_unavailable': 'yt-dlp nao esta disponivel para buscar legendas externas deste video.',

    'task.file_not_found': 'Nao consegui localizar essa tarefa. Use /tasks para descobrir o id curto correto ou descreva melhor a inspecao.',
    'task.unknown_command': 'Comando nao reconhecido.',
    'task.operator_mode_redirect': 'Comando direto reconhecido. Redirecionando para o fluxo de troca de modelo (/agmodel {model})...',

    'mode.operator_activated': 'Modo operador ativado.',
    'mode.operator_preparing': 'Agora eu vou preparar a tarefa...',
    'mode.operator_deactivated': 'Modo operador desativado.',
    'mode.operator_resuming': 'Agora o Zavorth volta a executar imediatamente...',
    'mode.operator_status_active': 'O modo operador esta ativo.',
    'mode.operator_status_inactive': 'O modo operador esta inativo.',
    'mode.presentation_activated': 'Modo de apresentacao ativado.',
    'mode.presentation_deactivated': 'Modo de apresentacao desativado.',
    'mode.presentation_status_active': 'O modo de apresentacao esta ativo.',
    'mode.presentation_status_inactive': 'O modo de apresentacao esta inativo.',

    'media.image_attached': '[Imagem anexada]',
    'media.image_attached_prompt': '[Imagem anexada] Por favor, analise ou descreva esta imagem.',
    'media.photo_analysis_failed': 'Nao consegui analisar essa foto agora.\n\nMotivo: {error}',
    'media.path_not_returned': 'Caminho nao retornado pelo Telegram.',
    'media.transcription_unavailable': '[Transcricao local indisponivel]',
    'media.transcription_unavailable_detail': '[Transcricao local indisponivel: {error}]',
    'media.transcription_unavailable_fallback': 'transcricao local indisponivel',
    'media.audio_processing_capability': 'Para processar este audio eu preciso ativar uma capability opcional deste host.',
    'media.audio_transcription_failed': 'Nao consegui transcrever esse audio agora.\n\nMotivo: {error}',
    'media.video_processing_capability': 'Para preparar esse video eu preciso ativar a trilha multimidia opcional.',
    'media.video_processing_failed': 'Nao consegui processar esse video agora.\n\nMotivo: {error}',
    'media.unsupported_format': 'Por enquanto eu consigo ler PDFs, DOCX, ODT, arquivos Markdown, TXT e midias suportadas. Se quiser, me envie em um desses formatos.',
    'media.document_no_text': 'Esse documento nao trouxe texto legivel. Tente outro arquivo ou um documento com texto extraivel.',
    'media.document_truncated': '...[Documento truncado para caber na analise inicial. Se precisar, solicite leitura segmentada.]',
    'media.document_prefix': '[Documento: {name}]',
    'media.document_reading_capability': 'Para ler esse documento eu preciso ativar a trilha multimidia opcional deste host.',
    'media.document_reading_failed': 'Nao consegui ler esse documento agora.\n\nMotivo: {error}',
    'media.pdf_reader_missing': 'O leitor de PDF opcional nao esta instalado neste host.',
    'media.audio_connectivity_pt': 'Sim, consigo te ouvir corretamente.',
    'media.audio_inconsistent_pt': 'Recebi seu audio, mas a transcricao automatica veio inconsistente. Nao vou inventar conteudo em cima disso. Pode repetir em uma frase curta?',
    'media.audio_connectivity_es': 'Si, puedo escucharte correctamente.',
    'media.audio_inconsistent_es': 'Recibi tu audio, pero la transcripcion automatica fue inconsistente. No voy a inventar contenido. Puedes repetirlo en una frase corta?',
    'media.audio_connectivity_en': 'Yes, I can hear you correctly.',
    'media.audio_inconsistent_en': 'I received your audio, but the automatic transcription looked unreliable. I will not invent content from it. Could you repeat it in one short sentence?',
    'media.safety_detail_pt': 'Detalhe tecnico',
    'media.safety_detail_es': 'Detalle tecnico',
    'media.safety_detail_en': 'Technical detail',
    'media.unknown_error': 'erro desconhecido',

    'selfmod.private_only': 'O /selfmod so pode ser usado em chat privado com o Zavorth.',
    'selfmod.build_mode_required': 'Modo operacional insuficiente. /selfmod exige modo BUILD.\nModo atual: {mode}\n\nUse /mode BUILD para habilitar.',
    'selfmod.owner_required': 'Voce pode gerar propostas com /selfmod, mas aplicar ou reverter mudancas reais exige papel owner/trusted.',

    'wsl.starting': 'Iniciando WSL...',
    'wsl.starting_distro': 'Iniciando WSL na distro {distro}...',
    'wsl.shutting_down': 'Desligando WSL e liberando RAM...',
    'wsl.access_error': 'Erro ao acessar WSL: {error}',
    'wsl.default_marker': ' (padrao)',
    'wsl.usage': 'Use /wsl on para ligar ou /wsl off para desligar.',

    'zavorthControl.failed_to_start': 'Falha ao iniciar ZavorthControl: {error}',
    'zavorthControl.public_url': 'URL publica configurada:',
    'zavorthControl.remote_bridge': 'ZavorthBridge remoto para celular:',
    'zavorthControl.warnings': 'Avisos:',
  },
} as const;

type NluPatternSet = {
  remoteActivate: RegExp;
  remoteDeactivate: RegExp;
  remoteStatus: RegExp;
  changesSummary: RegExp;
  reload: RegExp;
  autorepair: RegExp;
  selfmodPrivateOnly: RegExp;
  selfmodBuildMode: RegExp;
  selfmodOwnerRequired: RegExp;
  strongAutonomyIntent: RegExp;
  registerAsArm: RegExp;
  consent: RegExp;
  apply: RegExp;
  overwrite: RegExp;
};

const nluPatterns: Record<string, NluPatternSet> = {
  en: {
    remoteActivate: /\/remote\s+(on|activate)|enable\s+remote\s+mode|turn\s+on\s+remote|remote\s+mode\s+on|activate\s+remote/i,
    remoteDeactivate: /\/remote\s+(off|deactivate)|disable\s+remote\s+mode|turn\s+off\s+remote|remote\s+mode\s+off|deactivate\s+remote/i,
    remoteStatus: /\/remote(\s+status)?|remote\s+mode\s+(status|check)|check\s+remote|status\s+remote/i,
    changesSummary: /summary\s+(of\s+)?recent\s+changes|show\s+(me\s+)?(recent|latest)\s+changes|what\s+(changed|is\s+new)|list\s+changes/i,
    reload: /self[- ]?update|reload\s+zavorth|restart\s+zavorth|update\s+zavorth|refresh\s+zavorth/i,
    autorepair: /self[- ]?repair|autorepair|fix\s+(yourself|zavorth)|improve\s+(yourself|zavorth)|repair\s+zavorth/i,
    selfmodPrivateOnly: /only\s+(be\s+)?used\s+in\s+a\s+private\s+chat|private\s+chat\s+only/i,
    selfmodBuildMode: /requires?\s+build\s+mode|build\s+mode\s+required/i,
    selfmodOwnerRequired: /requires?\s+(owner|trusted)\s+role|owner\s+role\s+required/i,
    strongAutonomyIntent: /\b(fix|repair|modify|change|implement|create|generate\s+file|run|execute|automate|do\s+it\s+yourself|go\s+ahead|apply|edit)\b/i,
    registerAsArm: /\b(register-as-arm|use\s+as\s+arm|register\s+as\s+arm)\b/i,
    consent: /\b(consent|i\s+agree|i\s+authorize|read-only)\b/i,
    apply: /\b(apply|import\s+now|migrate\s+now)\b/i,
    overwrite: /\b(overwrite)\b/i,
  },
  pt: {
    remoteActivate: /\/remote\s+(on|activate|ativar)|\/remoto\s+(on|ativar)|ativar( o)? modo\s+remoto|ligar( o)? modo\s+remoto|modo\s+remoto\s+(on|ligar|ativar)/i,
    remoteDeactivate: /\/remote\s+(off|deactivate|desativar)|\/remoto\s+(off|desativar)|desativar( o)? modo\s+remoto|desligar( o)? modo\s+remoto|modo\s+remoto\s+(off|desligar|desativar)/i,
    remoteStatus: /\/remote(\s+status)?|\/remoto(\s+status)?|status\s+(do\s+)?modo\s+remoto|ver\s+modo\s+remoto|modo\s+remoto\s+status/i,
    changesSummary: /resumo\s+(das\s+)?ultimas?\s+(alteracoes|mudancas)|resuma\s+(as\s+)?ultimas?\s+(alteracoes|mudancas)|mostre\s+(as\s+)?ultimas?\s+(alteracoes|mudancas)/i,
    reload: /se\s+(autoatualize|atualize)|atualize\s+o\s+zavorth|recarregue\s+o\s+zavorth|reinicie\s+o\s+zavorth|suba\s+o\s+zavorth|religue\s+o\s+zavorth/i,
    autorepair: /se\s+(autorepare|conserte|melhore|otimize)|tente\s+se\s+corrigir|corrija\s+o\s+zavorth|faca\s+autoreparo|melhore\s+o\s+zavorth|otimize\s+o\s+zavorth/i,
    selfmodPrivateOnly: /so\s+pode\s+ser\s+usado\s+em\s+chat\s+privado|chat\s+privado\s+apenas/i,
    selfmodBuildMode: /exige\s+modo\s+build|modo\s+build\s+necessario/i,
    selfmodOwnerRequired: /exige\s+papel\s+(owner|trusted)|papel\s+(owner|trusted)\s+necessario/i,
    strongAutonomyIntent: /\b(arrume|corrija|conserte|modifique|altere|implante|implemente|crie|gere\s+arquivo|rode|execute|automatize|fa[cç]a\s+sozinho|pode\s+seguir|pode\s+fazer|aplique|mude\s+o\s+sistema|edite)\b/i,
    registerAsArm: /\b(register-as-arm|usar\s+como\s+braco|registrar\s+como\s+braco|braco)\b/i,
    consent: /\b(consent|autorizo|autorizei|pode|read-only|somente\s+leitura)\b/i,
    apply: /\b(apply|aplicar|importar\s+agora|migrar\s+agora)\b/i,
    overwrite: /\b(overwrite|sobrescrever)\b/i,
  },
};

const lang = (process.env.ZAVORTH_LANG || 'en').split('-')[0] as keyof typeof messages;

function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const dict = messages[lang] || messages.en;
  let msg: string = dict[key] || messages.en[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return msg;
}

function getNluPatterns(): NluPatternSet {
  const primary = nluPatterns[lang] || nluPatterns.en;
  const secondary = lang === 'pt' ? nluPatterns.en : nluPatterns.pt;

  const merged: NluPatternSet = {
    remoteActivate: new RegExp(`(?:${primary.remoteActivate.source})|(?:${secondary.remoteActivate.source})`, 'i'),
    remoteDeactivate: new RegExp(`(?:${primary.remoteDeactivate.source})|(?:${secondary.remoteDeactivate.source})`, 'i'),
    remoteStatus: new RegExp(`(?:${primary.remoteStatus.source})|(?:${secondary.remoteStatus.source})`, 'i'),
    changesSummary: new RegExp(`(?:${primary.changesSummary.source})|(?:${secondary.changesSummary.source})`, 'i'),
    reload: new RegExp(`(?:${primary.reload.source})|(?:${secondary.reload.source})`, 'i'),
    autorepair: new RegExp(`(?:${primary.autorepair.source})|(?:${secondary.autorepair.source})`, 'i'),
    selfmodPrivateOnly: new RegExp(`(?:${primary.selfmodPrivateOnly.source})|(?:${secondary.selfmodPrivateOnly.source})`, 'i'),
    selfmodBuildMode: new RegExp(`(?:${primary.selfmodBuildMode.source})|(?:${secondary.selfmodBuildMode.source})`, 'i'),
    selfmodOwnerRequired: new RegExp(`(?:${primary.selfmodOwnerRequired.source})|(?:${secondary.selfmodOwnerRequired.source})`, 'i'),
    strongAutonomyIntent: new RegExp(`(?:${primary.strongAutonomyIntent.source})|(?:${secondary.strongAutonomyIntent.source})`, 'i'),
    registerAsArm: new RegExp(`(?:${primary.registerAsArm.source})|(?:${secondary.registerAsArm.source})`, 'i'),
    consent: new RegExp(`(?:${primary.consent.source})|(?:${secondary.consent.source})`, 'i'),
    apply: new RegExp(`(?:${primary.apply.source})|(?:${secondary.apply.source})`, 'i'),
    overwrite: new RegExp(`(?:${primary.overwrite.source})|(?:${secondary.overwrite.source})`, 'i'),
  };

  return merged;
}

export { t, messages, getNluPatterns };
export type { MessageKey, NluPatternSet };
