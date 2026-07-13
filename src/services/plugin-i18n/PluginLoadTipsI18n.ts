export type PluginLoadTipId =
  | 'tip.export_register'
  | 'tip.bind_capability'
  | 'tip.declare_capability'
  | 'tip.enable_plugin'
  | 'tip.install_enable'
  | 'tip.entrypoint_module'
  | 'tip.declare_capabilities'
  | 'tip.bind_all_capabilities'
  | 'tip.add_manifest'
  | 'tip.export_function'
  | 'tip.fast_register'
  | 'tip.clear_block';

export type PluginLoadTipsCatalog = Record<PluginLoadTipId, string>;

const en: PluginLoadTipsCatalog = {
  'tip.export_register':
    'Export `register` or `createZavorthModule` from index.js (CommonJS: module.exports = { register }).',
  'tip.bind_capability':
    'Call ctx.bindCapability(...) for each capability declared in manifest.json.',
  'tip.declare_capability':
    'Add capability {{cap}} to manifest.json or declare it via definePlugin tools: {}.',
  'tip.enable_plugin':
    'Run: zavorth plugins enable {{pluginId}} --yes or pass approval / trusted trust.',
  'tip.install_enable':
    'Install and enable the plugin: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    'Ensure manifest.entrypoint.module points to an existing file (usually ./index.js).',
  'tip.declare_capabilities':
    'Declare at least one capability under manifest.capabilities (e.g. main.run).',
  'tip.bind_all_capabilities':
    'Bind every declared capability id with ctx.bindCapability, bindTool, bindChannel, bindMemoryBackend, or bindProvider.',
  'tip.add_manifest':
    'Add a Plugin OS manifest.json (schemaVersion zavorth.plugin-os.v1) in the package directory.',
  'tip.export_function':
    'The resolved export must be a function register(ctx) or a module definition with a handler.',
  'tip.fast_register':
    'Keep register() fast and free of blocking network I/O at load time.',
  'tip.clear_block':
    'Plugin is blocked. Clear with: zavorth plugins trust {{pluginId}} review --yes',
};

const pt: PluginLoadTipsCatalog = {
  'tip.export_register':
    'Exporte `register` ou `createZavorthModule` em index.js (CommonJS: module.exports = { register }).',
  'tip.bind_capability':
    'Chame ctx.bindCapability(...) para cada capability declarada em manifest.json.',
  'tip.declare_capability':
    'Adicione a capability {{cap}} em manifest.json ou declare via definePlugin tools: {}.',
  'tip.enable_plugin':
    'Execute: zavorth plugins enable {{pluginId}} --yes ou aprove / confie no plugin.',
  'tip.install_enable':
    'Instale e habilite: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    'Garanta que manifest.entrypoint.module aponte para um arquivo existente (geralmente ./index.js).',
  'tip.declare_capabilities':
    'Declare ao menos uma capability em manifest.capabilities (ex.: main.run).',
  'tip.bind_all_capabilities':
    'Vincule cada capability com ctx.bindCapability, bindTool, bindChannel, bindMemoryBackend ou bindProvider.',
  'tip.add_manifest':
    'Adicione um manifest.json do Plugin OS (schemaVersion zavorth.plugin-os.v1) no pacote.',
  'tip.export_function':
    'O export resolvido deve ser uma função register(ctx) ou um módulo com handler.',
  'tip.fast_register':
    'Mantenha register() rápido e sem I/O de rede bloqueante no carregamento.',
  'tip.clear_block':
    'Plugin bloqueado. Libere com: zavorth plugins trust {{pluginId}} review --yes',
};

const es: PluginLoadTipsCatalog = {
  'tip.export_register':
    'Exporte `register` o `createZavorthModule` desde index.js (CommonJS: module.exports = { register }).',
  'tip.bind_capability':
    'Llame ctx.bindCapability(...) por cada capability declarada en manifest.json.',
  'tip.declare_capability':
    'Añada la capability {{cap}} en manifest.json o declárela con definePlugin tools: {}.',
  'tip.enable_plugin':
    'Ejecute: zavorth plugins enable {{pluginId}} --yes o apruebe / confíe el plugin.',
  'tip.install_enable':
    'Instale y habilite: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    'Asegúrese de que manifest.entrypoint.module apunte a un archivo existente (normalmente ./index.js).',
  'tip.declare_capabilities':
    'Declare al menos una capability en manifest.capabilities (p. ej. main.run).',
  'tip.bind_all_capabilities':
    'Enlace cada capability con ctx.bindCapability, bindTool, bindChannel, bindMemoryBackend o bindProvider.',
  'tip.add_manifest':
    'Añada un manifest.json de Plugin OS (schemaVersion zavorth.plugin-os.v1) en el paquete.',
  'tip.export_function':
    'El export resuelto debe ser una función register(ctx) o un módulo con handler.',
  'tip.fast_register':
    'Mantenga register() rápido y sin I/O de red bloqueante al cargar.',
  'tip.clear_block':
    'Plugin bloqueado. Libere con: zavorth plugins trust {{pluginId}} review --yes',
};

const fr: PluginLoadTipsCatalog = {
  'tip.export_register':
    'Exportez `register` ou `createZavorthModule` depuis index.js (CommonJS: module.exports = { register }).',
  'tip.bind_capability':
    'Appelez ctx.bindCapability(...) pour chaque capability déclarée dans manifest.json.',
  'tip.declare_capability':
    'Ajoutez la capability {{cap}} dans manifest.json ou déclarez-la via definePlugin tools: {}.',
  'tip.enable_plugin':
    'Exécutez: zavorth plugins enable {{pluginId}} --yes ou approuvez / faites confiance au plugin.',
  'tip.install_enable':
    'Installez et activez: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    'Vérifiez que manifest.entrypoint.module pointe vers un fichier existant (souvent ./index.js).',
  'tip.declare_capabilities':
    'Déclarez au moins une capability sous manifest.capabilities (ex. main.run).',
  'tip.bind_all_capabilities':
    'Liez chaque capability avec ctx.bindCapability, bindTool, bindChannel, bindMemoryBackend ou bindProvider.',
  'tip.add_manifest':
    'Ajoutez un manifest.json Plugin OS (schemaVersion zavorth.plugin-os.v1) dans le package.',
  'tip.export_function':
    'L’export résolu doit être une fonction register(ctx) ou un module avec handler.',
  'tip.fast_register':
    'Gardez register() rapide sans I/O réseau bloquante au chargement.',
  'tip.clear_block':
    'Plugin bloqué. Débloquez avec: zavorth plugins trust {{pluginId}} review --yes',
};

const de: PluginLoadTipsCatalog = {
  'tip.export_register':
    'Exportieren Sie `register` oder `createZavorthModule` aus index.js (CommonJS: module.exports = { register }).',
  'tip.bind_capability':
    'Rufen Sie ctx.bindCapability(...) für jede in manifest.json deklarierte Capability auf.',
  'tip.declare_capability':
    'Fügen Sie Capability {{cap}} zu manifest.json hinzu oder deklarieren Sie sie über definePlugin tools: {}.',
  'tip.enable_plugin':
    'Ausführen: zavorth plugins enable {{pluginId}} --yes oder Freigabe / trusted trust setzen.',
  'tip.install_enable':
    'Plugin installieren und aktivieren: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    'Stellen Sie sicher, dass manifest.entrypoint.module auf eine vorhandene Datei zeigt (meist ./index.js).',
  'tip.declare_capabilities':
    'Deklarieren Sie mindestens eine Capability unter manifest.capabilities (z. B. main.run).',
  'tip.bind_all_capabilities':
    'Binden Sie jede Capability mit ctx.bindCapability, bindTool, bindChannel, bindMemoryBackend oder bindProvider.',
  'tip.add_manifest':
    'Fügen Sie eine Plugin-OS-manifest.json (schemaVersion zavorth.plugin-os.v1) hinzu.',
  'tip.export_function':
    'Der aufgelöste Export muss eine Funktion register(ctx) oder ein Modul mit Handler sein.',
  'tip.fast_register':
    'Halten Sie register() schnell und ohne blockierendes Netzwerk-I/O beim Laden.',
  'tip.clear_block':
    'Plugin gesperrt. Freigeben mit: zavorth plugins trust {{pluginId}} review --yes',
};

const it: PluginLoadTipsCatalog = {
  'tip.export_register':
    'Esporta `register` o `createZavorthModule` da index.js (CommonJS: module.exports = { register }).',
  'tip.bind_capability':
    'Chiama ctx.bindCapability(...) per ogni capability dichiarata in manifest.json.',
  'tip.declare_capability':
    'Aggiungi la capability {{cap}} a manifest.json o dichiarala con definePlugin tools: {}.',
  'tip.enable_plugin':
    'Esegui: zavorth plugins enable {{pluginId}} --yes oppure approva / confida nel plugin.',
  'tip.install_enable':
    'Installa e abilita: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    'Assicurati che manifest.entrypoint.module punti a un file esistente (di solito ./index.js).',
  'tip.declare_capabilities':
    'Dichiara almeno una capability in manifest.capabilities (es. main.run).',
  'tip.bind_all_capabilities':
    'Collega ogni capability con ctx.bindCapability, bindTool, bindChannel, bindMemoryBackend o bindProvider.',
  'tip.add_manifest':
    'Aggiungi un manifest.json Plugin OS (schemaVersion zavorth.plugin-os.v1) nel pacchetto.',
  'tip.export_function':
    'L’export risolto deve essere una funzione register(ctx) o un modulo con handler.',
  'tip.fast_register':
    'Mantieni register() veloce e senza I/O di rete bloccante al caricamento.',
  'tip.clear_block':
    'Plugin bloccato. Sblocca con: zavorth plugins trust {{pluginId}} review --yes',
};

const ja: PluginLoadTipsCatalog = {
  'tip.export_register':
    'index.js から `register` または `createZavorthModule` をエクスポートしてください（CommonJS: module.exports = { register }）。',
  'tip.bind_capability':
    'manifest.json で宣言した各 capability に対して ctx.bindCapability(...) を呼び出してください。',
  'tip.declare_capability':
    'capability {{cap}} を manifest.json に追加するか、definePlugin tools: {} で宣言してください。',
  'tip.enable_plugin':
    '実行: zavorth plugins enable {{pluginId}} --yes、または承認 / trusted を設定してください。',
  'tip.install_enable':
    'インストールして有効化: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    'manifest.entrypoint.module が存在するファイル（通常 ./index.js）を指すようにしてください。',
  'tip.declare_capabilities':
    'manifest.capabilities に少なくとも 1 つの capability を宣言してください（例: main.run）。',
  'tip.bind_all_capabilities':
    '宣言した各 capability を ctx.bindCapability / bindTool / bindChannel / bindMemoryBackend / bindProvider でバインドしてください。',
  'tip.add_manifest':
    'パッケージに Plugin OS の manifest.json（schemaVersion zavorth.plugin-os.v1）を追加してください。',
  'tip.export_function':
    '解決された export は register(ctx) 関数、または handler を持つモジュール定義である必要があります。',
  'tip.fast_register':
    'register() は高速に保ち、ロード時のブロッキングネットワーク I/O を避けてください。',
  'tip.clear_block':
    'プラグインはブロックされています。解除: zavorth plugins trust {{pluginId}} review --yes',
};

const zh: PluginLoadTipsCatalog = {
  'tip.export_register':
    '从 index.js 导出 `register` 或 `createZavorthModule`（CommonJS: module.exports = { register }）。',
  'tip.bind_capability':
    '对 manifest.json 中声明的每个 capability 调用 ctx.bindCapability(...)。',
  'tip.declare_capability':
    '将 capability {{cap}} 添加到 manifest.json，或通过 definePlugin tools: {} 声明。',
  'tip.enable_plugin':
    '运行: zavorth plugins enable {{pluginId}} --yes，或通过审批 / 信任设置。',
  'tip.install_enable':
    '安装并启用: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    '确保 manifest.entrypoint.module 指向存在的文件（通常为 ./index.js）。',
  'tip.declare_capabilities':
    '在 manifest.capabilities 中至少声明一个 capability（例如 main.run）。',
  'tip.bind_all_capabilities':
    '使用 ctx.bindCapability、bindTool、bindChannel、bindMemoryBackend 或 bindProvider 绑定每个 capability。',
  'tip.add_manifest':
    '在包目录中添加 Plugin OS 的 manifest.json（schemaVersion zavorth.plugin-os.v1）。',
  'tip.export_function':
    '解析到的导出必须是 register(ctx) 函数或带 handler 的模块定义。',
  'tip.fast_register':
    '保持 register() 快速，加载时避免阻塞网络 I/O。',
  'tip.clear_block':
    '插件已阻止。解除: zavorth plugins trust {{pluginId}} review --yes',
};

const zhHant: PluginLoadTipsCatalog = {
  'tip.export_register':
    '從 index.js 匯出 `register` 或 `createZavorthModule`（CommonJS: module.exports = { register }）。',
  'tip.bind_capability':
    '對 manifest.json 中宣告的每個 capability 呼叫 ctx.bindCapability(...)。',
  'tip.declare_capability':
    '將 capability {{cap}} 加入 manifest.json，或透過 definePlugin tools: {} 宣告。',
  'tip.enable_plugin':
    '執行: zavorth plugins enable {{pluginId}} --yes，或完成核准 / 信任設定。',
  'tip.install_enable':
    '安裝並啟用: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    '確保 manifest.entrypoint.module 指向存在的檔案（通常為 ./index.js）。',
  'tip.declare_capabilities':
    '在 manifest.capabilities 至少宣告一個 capability（例如 main.run）。',
  'tip.bind_all_capabilities':
    '使用 ctx.bindCapability、bindTool、bindChannel、bindMemoryBackend 或 bindProvider 綁定每個 capability。',
  'tip.add_manifest':
    '在套件目錄新增 Plugin OS 的 manifest.json（schemaVersion zavorth.plugin-os.v1）。',
  'tip.export_function':
    '解析到的匯出必須是 register(ctx) 函式或具 handler 的模組定義。',
  'tip.fast_register':
    '保持 register() 快速，載入時避免阻塞網路 I/O。',
  'tip.clear_block':
    '外掛已封鎖。解除: zavorth plugins trust {{pluginId}} review --yes',
};

const ko: PluginLoadTipsCatalog = {
  'tip.export_register':
    'index.js 에서 `register` 또는 `createZavorthModule` 을 내보내세요 (CommonJS: module.exports = { register }).',
  'tip.bind_capability':
    'manifest.json 에 선언된 각 capability 에 대해 ctx.bindCapability(...) 를 호출하세요.',
  'tip.declare_capability':
    'capability {{cap}} 를 manifest.json 에 추가하거나 definePlugin tools: {} 로 선언하세요.',
  'tip.enable_plugin':
    '실행: zavorth plugins enable {{pluginId}} --yes 또는 승인 / trusted 설정.',
  'tip.install_enable':
    '설치 및 활성화: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    'manifest.entrypoint.module 이 존재하는 파일(보통 ./index.js)을 가리키는지 확인하세요.',
  'tip.declare_capabilities':
    'manifest.capabilities 에 하나 이상의 capability 를 선언하세요 (예: main.run).',
  'tip.bind_all_capabilities':
    '선언된 각 capability 를 ctx.bindCapability, bindTool, bindChannel, bindMemoryBackend 또는 bindProvider 로 바인딩하세요.',
  'tip.add_manifest':
    '패키지에 Plugin OS manifest.json (schemaVersion zavorth.plugin-os.v1) 을 추가하세요.',
  'tip.export_function':
    '해석된 export 는 register(ctx) 함수이거나 handler 가 있는 모듈 정의여야 합니다.',
  'tip.fast_register':
    'register() 를 빠르게 유지하고 로드 시 차단 네트워크 I/O 를 피하세요.',
  'tip.clear_block':
    '플러그인이 차단되었습니다. 해제: zavorth plugins trust {{pluginId}} review --yes',
};

const ru: PluginLoadTipsCatalog = {
  'tip.export_register':
    'Экспортируйте `register` или `createZavorthModule` из index.js (CommonJS: module.exports = { register }).',
  'tip.bind_capability':
    'Вызовите ctx.bindCapability(...) для каждой capability, объявленной в manifest.json.',
  'tip.declare_capability':
    'Добавьте capability {{cap}} в manifest.json или объявите через definePlugin tools: {}.',
  'tip.enable_plugin':
    'Выполните: zavorth plugins enable {{pluginId}} --yes или одобрите / доверьте плагин.',
  'tip.install_enable':
    'Установите и включите: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    'Убедитесь, что manifest.entrypoint.module указывает на существующий файл (обычно ./index.js).',
  'tip.declare_capabilities':
    'Объявите хотя бы одну capability в manifest.capabilities (например main.run).',
  'tip.bind_all_capabilities':
    'Привяжите каждую capability через ctx.bindCapability, bindTool, bindChannel, bindMemoryBackend или bindProvider.',
  'tip.add_manifest':
    'Добавьте manifest.json Plugin OS (schemaVersion zavorth.plugin-os.v1) в пакет.',
  'tip.export_function':
    'Разрешённый export должен быть функцией register(ctx) или модулем с handler.',
  'tip.fast_register':
    'Держите register() быстрым, без блокирующего сетевого I/O при загрузке.',
  'tip.clear_block':
    'Плагин заблокирован. Снимите: zavorth plugins trust {{pluginId}} review --yes',
};

const uk: PluginLoadTipsCatalog = {
  'tip.export_register':
    'Експортуйте `register` або `createZavorthModule` з index.js (CommonJS: module.exports = { register }).',
  'tip.bind_capability':
    'Викличте ctx.bindCapability(...) для кожної capability, оголошеної в manifest.json.',
  'tip.declare_capability':
    'Додайте capability {{cap}} до manifest.json або оголосіть через definePlugin tools: {}.',
  'tip.enable_plugin':
    'Виконайте: zavorth plugins enable {{pluginId}} --yes або схваліть / довірте плагін.',
  'tip.install_enable':
    'Встановіть і ввімкніть: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    'Переконайтеся, що manifest.entrypoint.module вказує на наявний файл (зазвичай ./index.js).',
  'tip.declare_capabilities':
    'Оголосіть принаймні одну capability у manifest.capabilities (наприклад main.run).',
  'tip.bind_all_capabilities':
    'Прив’яжіть кожну capability через ctx.bindCapability, bindTool, bindChannel, bindMemoryBackend або bindProvider.',
  'tip.add_manifest':
    'Додайте manifest.json Plugin OS (schemaVersion zavorth.plugin-os.v1) у пакет.',
  'tip.export_function':
    'Розв’язаний export має бути функцією register(ctx) або модулем з handler.',
  'tip.fast_register':
    'Тримайте register() швидким, без блокуючого мережевого I/O під час завантаження.',
  'tip.clear_block':
    'Плагін заблоковано. Зніміть: zavorth plugins trust {{pluginId}} review --yes',
};

const ar: PluginLoadTipsCatalog = {
  'tip.export_register':
    'صدّر `register` أو `createZavorthModule` من index.js (CommonJS: module.exports = { register }).',
  'tip.bind_capability':
    'استدعِ ctx.bindCapability(...) لكل capability معلنة في manifest.json.',
  'tip.declare_capability':
    'أضف capability {{cap}} إلى manifest.json أو أعلنها عبر definePlugin tools: {}.',
  'tip.enable_plugin':
    'نفّذ: zavorth plugins enable {{pluginId}} --yes أو وافق / امنح الثقة.',
  'tip.install_enable':
    'ثبّت وفعّل: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    'تأكد أن manifest.entrypoint.module يشير إلى ملف موجود (عادة ./index.js).',
  'tip.declare_capabilities':
    'أعلن عن capability واحدة على الأقل في manifest.capabilities (مثل main.run).',
  'tip.bind_all_capabilities':
    'اربط كل capability عبر ctx.bindCapability أو bindTool أو bindChannel أو bindMemoryBackend أو bindProvider.',
  'tip.add_manifest':
    'أضف manifest.json لـ Plugin OS (schemaVersion zavorth.plugin-os.v1) في الحزمة.',
  'tip.export_function':
    'يجب أن يكون التصدير المحلول دالة register(ctx) أو وحدة بها handler.',
  'tip.fast_register':
    'أبقِ register() سريعًا دون I/O شبكي حاجب عند التحميل.',
  'tip.clear_block':
    'الإضافة محظورة. أزل الحظر: zavorth plugins trust {{pluginId}} review --yes',
};

const hi: PluginLoadTipsCatalog = {
  'tip.export_register':
    'index.js से `register` या `createZavorthModule` निर्यात करें (CommonJS: module.exports = { register }).',
  'tip.bind_capability':
    'manifest.json में घोषित प्रत्येक capability के लिए ctx.bindCapability(...) कॉल करें।',
  'tip.declare_capability':
    'capability {{cap}} को manifest.json में जोड़ें या definePlugin tools: {} से घोषित करें।',
  'tip.enable_plugin':
    'चलाएँ: zavorth plugins enable {{pluginId}} --yes या अनुमोदन / trusted सेट करें।',
  'tip.install_enable':
    'इंस्टॉल और सक्षम करें: zavorth plugins install <path> --yes && zavorth plugins enable {{pluginId}} --yes',
  'tip.entrypoint_module':
    'सुनिश्चित करें कि manifest.entrypoint.module किसी मौजूदा फ़ाइल (आमतौर पर ./index.js) को इंगित करे।',
  'tip.declare_capabilities':
    'manifest.capabilities में कम से कम एक capability घोषित करें (जैसे main.run).',
  'tip.bind_all_capabilities':
    'प्रत्येक capability को ctx.bindCapability, bindTool, bindChannel, bindMemoryBackend या bindProvider से बाँधें।',
  'tip.add_manifest':
    'पैकेज में Plugin OS manifest.json (schemaVersion zavorth.plugin-os.v1) जोड़ें।',
  'tip.export_function':
    'रिज़ॉल्व्ड export एक register(ctx) फ़ंक्शन या handler वाला मॉड्यूल होना चाहिए।',
  'tip.fast_register':
    'register() को तेज़ रखें और लोड समय पर ब्लॉकिंग नेटवर्क I/O से बचें।',
  'tip.clear_block':
    'प्लगिन अवरुद्ध है। हटाएँ: zavorth plugins trust {{pluginId}} review --yes',
};

function localeVariant(base: PluginLoadTipsCatalog, tweak: Partial<PluginLoadTipsCatalog>): PluginLoadTipsCatalog {
  return { ...base, ...tweak };
}

/** All supported tip catalogs (ISO-ish keys). */
export const PLUGIN_LOAD_TIPS_CATALOGS: Record<string, PluginLoadTipsCatalog> = {
  en,
  pt,
  'pt-BR': localeVariant(pt, {
    'tip.enable_plugin':
      'Rode: zavorth plugins enable {{pluginId}} --yes ou aprove / confie no plugin.',
  }),
  'pt-PT': pt,
  es,
  fr,
  de,
  it,
  ja,
  zh,
  'zh-CN': zh,
  'zh-Hans': zh,
  'zh-Hant': zhHant,
  'zh-TW': zhHant,
  ko,
  ru,
  uk,
  ar,
  hi,
  nl: localeVariant(en, {
    'tip.export_register':
      'Exporteer `register` of `createZavorthModule` uit index.js (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'Roep ctx.bindCapability(...) aan voor elke capability in manifest.json.',
    'tip.enable_plugin':
      'Voer uit: zavorth plugins enable {{pluginId}} --yes of geef goedkeuring / trusted trust.',
  }),
  pl: localeVariant(en, {
    'tip.export_register':
      'Wyeksportuj `register` lub `createZavorthModule` z index.js (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'Wywołaj ctx.bindCapability(...) dla każdej capability z manifest.json.',
    'tip.enable_plugin':
      'Uruchom: zavorth plugins enable {{pluginId}} --yes lub zatwierdź / zaufaj wtyczce.',
  }),
  tr: localeVariant(en, {
    'tip.export_register':
      'index.js dosyasından `register` veya `createZavorthModule` dışa aktarın (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'manifest.json içinde tanımlı her capability için ctx.bindCapability(...) çağırın.',
    'tip.enable_plugin':
      'Çalıştırın: zavorth plugins enable {{pluginId}} --yes veya onay / trusted verin.',
  }),
  vi: localeVariant(en, {
    'tip.export_register':
      'Xuất `register` hoặc `createZavorthModule` từ index.js (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'Gọi ctx.bindCapability(...) cho mỗi capability khai báo trong manifest.json.',
    'tip.enable_plugin':
      'Chạy: zavorth plugins enable {{pluginId}} --yes hoặc phê duyệt / tin cậy plugin.',
  }),
  id: localeVariant(en, {
    'tip.export_register':
      'Ekspor `register` atau `createZavorthModule` dari index.js (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'Panggil ctx.bindCapability(...) untuk setiap capability di manifest.json.',
    'tip.enable_plugin':
      'Jalankan: zavorth plugins enable {{pluginId}} --yes atau setujui / percayai plugin.',
  }),
  th: localeVariant(en, {
    'tip.export_register':
      'ส่งออก `register` หรือ `createZavorthModule` จาก index.js (CommonJS: module.exports = { register })',
    'tip.bind_capability':
      'เรียก ctx.bindCapability(...) สำหรับทุก capability ใน manifest.json',
    'tip.enable_plugin':
      'รัน: zavorth plugins enable {{pluginId}} --yes หรืออนุมัติ / ตั้ง trusted',
  }),
  sv: localeVariant(en, {
    'tip.export_register':
      'Exportera `register` eller `createZavorthModule` från index.js (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'Anropa ctx.bindCapability(...) för varje capability i manifest.json.',
    'tip.enable_plugin':
      'Kör: zavorth plugins enable {{pluginId}} --yes eller godkänn / trusted trust.',
  }),
  cs: localeVariant(en, {
    'tip.export_register':
      'Exportujte `register` nebo `createZavorthModule` z index.js (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'Zavolejte ctx.bindCapability(...) pro každou capability v manifest.json.',
    'tip.enable_plugin':
      'Spusťte: zavorth plugins enable {{pluginId}} --yes nebo schvalte / trusted.',
  }),
  ro: localeVariant(en, {
    'tip.export_register':
      'Exportați `register` sau `createZavorthModule` din index.js (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'Apelați ctx.bindCapability(...) pentru fiecare capability din manifest.json.',
    'tip.enable_plugin':
      'Rulați: zavorth plugins enable {{pluginId}} --yes sau aprobați / trusted.',
  }),
  hu: localeVariant(en, {
    'tip.export_register':
      'Exportálja a `register` vagy `createZavorthModule` függvényt az index.js-ből (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'Hívja a ctx.bindCapability(...) metódust a manifest.json minden capability-jére.',
    'tip.enable_plugin':
      'Futtassa: zavorth plugins enable {{pluginId}} --yes vagy hagyja jóvá / trusted.',
  }),
  el: localeVariant(en, {
    'tip.export_register':
      'Εξάγετε `register` ή `createZavorthModule` από το index.js (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'Καλέστε ctx.bindCapability(...) για κάθε capability στο manifest.json.',
    'tip.enable_plugin':
      'Εκτελέστε: zavorth plugins enable {{pluginId}} --yes ή εγκρίνετε / trusted.',
  }),
  he: localeVariant(en, {
    'tip.export_register':
      'ייצאו `register` או `createZavorthModule` מ-index.js (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'קראו ל-ctx.bindCapability(...) עבור כל capability ב-manifest.json.',
    'tip.enable_plugin':
      'הריצו: zavorth plugins enable {{pluginId}} --yes או אשרו / trusted.',
  }),
  fa: localeVariant(en, {
    'tip.export_register':
      'از index.js تابع `register` یا `createZavorthModule` را صادر کنید (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'برای هر capability در manifest.json تابع ctx.bindCapability(...) را فراخوانی کنید.',
    'tip.enable_plugin':
      'اجرا کنید: zavorth plugins enable {{pluginId}} --yes یا تأیید / trusted.',
  }),
  bn: localeVariant(en, {
    'tip.export_register':
      'index.js থেকে `register` বা `createZavorthModule` এক্সপোর্ট করুন (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'manifest.json-এ ঘোষিত প্রতিটি capability-এর জন্য ctx.bindCapability(...) কল করুন।',
    'tip.enable_plugin':
      'চালান: zavorth plugins enable {{pluginId}} --yes অথবা অনুমোদন / trusted সেট করুন।',
  }),
  ms: localeVariant(en, {
    'tip.export_register':
      'Eksport `register` atau `createZavorthModule` dari index.js (CommonJS: module.exports = { register }).',
    'tip.bind_capability':
      'Panggil ctx.bindCapability(...) untuk setiap capability dalam manifest.json.',
    'tip.enable_plugin':
      'Jalankan: zavorth plugins enable {{pluginId}} --yes atau luluskan / trusted.',
  }),
};

export function resolvePluginLoadLocale(
  preferred?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const candidates = [
    preferred,
    env.ZAVORTH_LOCALE,
    env.LANG,
    env.LC_ALL,
  ]
    .map((value) => normalizeLocaleTag(value))
    .filter(Boolean) as string[];

  for (const candidate of candidates) {
    const matched = matchLocale(candidate);
    if (matched) {
      return matched;
    }
  }
  return 'en';
}

export function getPluginLoadTipsCatalog(locale?: string | null): PluginLoadTipsCatalog {
  const resolved = resolvePluginLoadLocale(locale);
  return PLUGIN_LOAD_TIPS_CATALOGS[resolved] || en;
}

export function formatPluginLoadTip(
  id: PluginLoadTipId,
  vars: Record<string, string> = {},
  locale?: string | null,
): string {
  const catalog = getPluginLoadTipsCatalog(locale);
  const template = catalog[id] || en[id] || id;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] !== undefined ? vars[key] : `{{${key}}}`;
  });
}

function normalizeLocaleTag(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  let tag = String(value).trim().replace(/_/g, '-');
  // LANG often looks like en_US.UTF-8
  tag = tag.split('.')[0] || tag;
  tag = tag.split('@')[0] || tag;
  if (!tag) {
    return null;
  }
  const parts = tag.split('-');
  if (parts.length === 1) {
    return parts[0].toLowerCase();
  }
  const lang = parts[0].toLowerCase();
  const rest = parts.slice(1).map((part, index) => {
    if (part.toLowerCase() === 'hant' || part.toLowerCase() === 'hans') {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }
    if (part.length === 2 || part.length === 3) {
      return part.toUpperCase();
    }
    return index === 0 ? part : part;
  });
  return [lang, ...rest].join('-');
}

function matchLocale(tag: string): string | null {
  if (PLUGIN_LOAD_TIPS_CATALOGS[tag]) {
    return tag;
  }
  const lower = tag.toLowerCase();
  for (const key of Object.keys(PLUGIN_LOAD_TIPS_CATALOGS)) {
    if (key.toLowerCase() === lower) {
      return key;
    }
  }
  // language prefix: pt-BR -> pt
  const lang = tag.split('-')[0]?.toLowerCase();
  if (lang && PLUGIN_LOAD_TIPS_CATALOGS[lang]) {
    return lang;
  }
  // zh-Hant family
  if (lang === 'zh' && /hant|tw|hk/i.test(tag)) {
    if (PLUGIN_LOAD_TIPS_CATALOGS['zh-Hant']) {
      return 'zh-Hant';
    }
  }
  return null;
}
