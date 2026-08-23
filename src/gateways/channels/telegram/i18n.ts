/**
 * Lightweight i18n for Telegram bot strings.
 * Default language is English. Override with ZAVORTH_LANG / ZAVORTH_LOCALE.
 *
 * Strings resolve through the unified localization system (migrated telegram
 * catalogs behind src/i18n/ZavorthI18nService); the inline dictionary below is
 * a typed hermetic fallback for sandboxes where catalogs are unavailable.
 *
 * Usage:
 *   import { t } from '../../../gateways/channels/telegram/i18n.js';
 *   await ctx.reply(t('auth.access_restricted'));
 *
 * agent-first routing: free text goes to the agent; explicit /slash commands
 * are handled by command routers. Free-text NLU packs were removed.
 */

import { getI18nService } from '../../../i18n/ZavorthI18nService.js';

type MessageKey = keyof typeof messages.en;

const messages = {
  en: {
    'auth.access_restricted': '⛔ **Access Restricted:**\n\nAs a vice-owner, you do not have permission to use this system/computer command. You have access to research, memory, conversations, and analysis.',
    'auth.host_readonly': 'New host detected. Zavorth entered read-only mode until re-authorization.\nUse `/hostauth status` to inspect and `/hostauth trust` on the current host to enable execution.',
    'auth.unauthorized_group_admin': 'Only group administrators can use this command.',
    'auth.unauthorized_sarcasm_1': "Who gave you permission to talk to me, mortal... Try `/roll` if you want to play.",
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
    'scheduler.report_format': 'Format: /report every <Xm|Xh> <topic>\nExample: /report structured interval schedule bitcoin price',

    'scheduler.starting': 'The scheduler is still starting...',
    'scheduler.usage': 'Usage: /schedule <request>',
    'scheduler.invalid_format': 'Invalid schedule request. Describe the cadence and action naturally.',

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
    'media.audio_connectivity_pt': 'Yes, I can hear you correctly.',
    'media.audio_inconsistent_pt': 'I received your audio, but the automatic transcription looked unreliable. I will not invent content from it. Could you repeat it in one short sentence...',
    'media.audio_connectivity_es': 'Yes, I can hear you correctly.',
    'media.audio_inconsistent_es': 'I received your audio, but the automatic transcription looked unreliable. I will not invent content from it. Could you repeat it in one short sentence...',
    'media.audio_connectivity_en': 'Yes, I can hear you correctly.',
    'media.audio_inconsistent_en': 'I received your audio, but the automatic transcription looked unreliable. I will not invent content from it. Could you repeat it in one short sentence...',
    'media.safety_detail_pt': 'Technical detail',
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
} as const;

function normalizeInlineLanguage(value: string): keyof typeof messages {
  const raw = String(value || 'en').trim().toLowerCase();
  const separators = ['-', '_'];
  let normalized = raw;
  for (const separator of separators) {
    const index = normalized.indexOf(separator);
    if (index > 0) normalized = normalized.slice(0, index);
  }
  return Object.prototype.hasOwnProperty.call(messages, normalized) ? normalized as keyof typeof messages : 'en';
}
const lang = normalizeInlineLanguage(process.env.ZAVORTH_LANG || process.env.ZAVORTH_LOCALE || 'en');

function resolveTelegramLocale(): string {
  const raw = String(process.env.ZAVORTH_LANG || process.env.ZAVORTH_LOCALE || 'en-US').trim();
  if (!raw) return 'en-US';
  try {
    return new Intl.Locale(raw).toString();
  } catch {
    return raw;
  }
}

// Sync central service locale once at module load (tests can call setLocale via reset + reimport).
try {
  getI18nService().setLocale(resolveTelegramLocale());
} catch {
  // Locales may be unavailable in some hermetic test sandboxes; inline dict remains.
}

function t(key: MessageKey, vars?: Record<string, string | number>): string {
  try {
    const i18n = getI18nService();
    const central = i18n.t(`telegram.${key}`, {
      vars,
      locale: resolveTelegramLocale(),
      fallback: '',
    });
    if (central && central !== key && central !== `telegram.${key}`) {
      return central;
    }
  } catch {
    // fall through to inline dictionary
  }

  const dict = messages[lang] || messages.en;
  let msg: string = dict[key] || messages.en[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.split(`{${k}}`).join(String(v));
    }
  }
  return msg;
}

export { t, messages };
export type { MessageKey };
