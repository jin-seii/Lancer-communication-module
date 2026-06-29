export class LancerCommunicator {
    static MODULE_ID = 'lancer-communicator-dcw';
    static LEGACY_MODULE_ID = 'lancer-communicator';
    static SYSTEM_AI_VOICE_FILES = [
        'snd_wngdng1.wav',
        'snd_wngdng2.wav',
        'snd_wngdng3.wav',
        'snd_wngdng4.wav',
        'snd_wngdng5.wav',
        'snd_wngdng6.wav',
        'snd_wngdng7.wav'
    ];
    static SYSTEM_AI_MIN_INTERVAL_MS = 45;
    static SYSTEM_AI_MAX_CONCURRENT = 4;

    /** Кэшированные настройки модуля */
    static settings = {
        globalTypingSpeed: 130,
        typingSpeed: null, // null означает использование глобальной скорости
        sentencePauseDelay: 300,
        voiceVolume: 0.3,
        fontFamily: 'Purista',
        globalMessageWidth: 30,
        debugMode: false
    };

    /** Текущее активное аудио (для прерывания при новом сообщении) */
    static currentAudio = null;

    /** Текущий контейнер сообщения */
    static currentContainer = null;

    /** Список сохранённых сообщений для экспорта */
    static savedMessages = [];

    /** Активные короткие звуки набора (System AI) */
    static activeTypingSounds = new Set();

    /** Последний timestamp воспроизведения System AI звука */
    static lastSystemAIVoicePlayAt = 0;

    /** Список доступных шрифтов для диалога */
    static FONTS = [
        'MOSCOW2024',
        'Purista',
        'Purista Bold',
        'Orbitron',
        'Share Tech Mono',
        'Chakra Petch',
        'Space Mono',
        'Handjet',
        'Undertale',
        'TeletactileRus',
        'Kereru',
        'Serif',
        'Sans-serif'
    ];

    /** Список доступных стилей сообщения */
    static STYLES = [
        { value: 'green', i18nKey: 'LANCER.Settings.MSGStyleGr' },
        { value: 'blue', i18nKey: 'LANCER.Settings.MSGStyleBl' },
        { value: 'yellow', i18nKey: 'LANCER.Settings.MSGStyleYe' },
        { value: 'red', i18nKey: 'LANCER.Settings.MSGStyleRe' },
        { value: 'damaged', i18nKey: 'LANCER.Settings.MSGStyleDm' },
        { value: 'undertale', i18nKey: 'LANCER.Settings.MSGStyleUn' }
    ];

    /**
     * Выводит отладочное сообщение в консоль, если включен режим дебага
     * @param {string} message - Сообщение для вывода
     * @param {...any} args - Дополнительные аргументы
     */
    static debug(message, ...args) {
        const debugMode = game.settings?.get('lancer-communicator-dcw', 'debugMode') ?? false;
        if (debugMode) {
            console.log(`Lancer Communicator | DEBUG | ${message}`, ...args);
        }
    }

    /**
     * Прерывает текущее воспроизводимое сообщение
     */
    static _stopCurrentMessage() {
        // Останавливаем аудио
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
            this.debug('Stopped current audio');
        }

        // Останавливаем короткие звуки набора, если сообщение было прервано
        if (this.activeTypingSounds.size > 0) {
            for (const audio of this.activeTypingSounds) {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (_e) {
                    // Ignore stop errors.
                }
            }
            this.activeTypingSounds.clear();
            this.lastSystemAIVoicePlayAt = 0;
        }

        // Удаляем контейнер
        if (this.currentContainer) {
            this.currentContainer.remove();
            this.currentContainer = null;
            this.debug('Removed current container');
        }
    }

    /**
     * Инициализирует слушателей сокетов для коммуникации между клиентами
     */
    static initSocketListeners() {
        if (!game.socket) return;

        this._cacheSettings();

        game.socket.on('module.lancer-communicator-dcw', (payload) => {
            if (payload?.type === 'showMessage' && payload.data?.characterName) {
                this.savedMessages.push({
                    ...payload.data,
                    timestamp: payload.data.timestamp || new Date().toISOString()
                });
                this.showCommunicatorMessage(payload.data).catch(console.error);
            }
        });

        this.debug('Socket listeners initialized');
    }

    /**
     * Загружает и кэширует настройки модуля
     */
    static _cacheSettings() {
        this.settings.globalTypingSpeed = game.settings.get('lancer-communicator-dcw', 'globalTypingSpeed') ?? 130;
        this.settings.sentencePauseDelay = game.settings.get('lancer-communicator-dcw', 'sentencePauseDelay') ?? 300;
        this.settings.voiceVolume = game.settings.get('lancer-communicator-dcw', 'voiceVolume') ?? 0.3;
        this.settings.fontFamily = game.settings.get('lancer-communicator-dcw', 'fontFamily') || 'Purista';
        this.settings.globalMessageWidth = game.settings.get('lancer-communicator-dcw', 'globalMessageWidth') ?? 30;
        this.settings.debugMode = game.settings.get('lancer-communicator-dcw', 'debugMode') ?? false;
        this.debug('Settings cached:', this.settings);
    }

    /**
     * Возвращает эффективную скорость печати (из параметра или глобальную)
     * @param {number|null} typingSpeed - Указанная скорость или null для использования глобальной
     * @returns {number}
     */
    static _getEffectiveTypingSpeed(typingSpeed) {
        const effective = typingSpeed ?? this.settings.globalTypingSpeed;
        this.debug(`Effective typing speed: ${effective} (param: ${typingSpeed}, global: ${this.settings.globalTypingSpeed})`);
        return effective;
    }

    // ─── DOM HELPERS ───────────────────────────────────────────────

    /**
     * Безопасно извлекает значение элемента формы
     * @param {HTMLFormElement} form - Форма
     * @param {string} selector - CSS селектор
     * @returns {string}
     */
    static _getFormValue(form, selector) {
        return form.querySelector(selector)?.value ?? '';
    }

    /**
     * Экранирует HTML-спецсимволы для безопасной вставки в innerHTML
     * @param {string} str
     * @returns {string}
     */
    static _escapeHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    /**
     * Возвращает случайный путь к System AI голосу
     * @returns {string|null}
     */
    static _getRandomSystemAIVoicePath() {
        if (!Array.isArray(this.SYSTEM_AI_VOICE_FILES) || this.SYSTEM_AI_VOICE_FILES.length === 0) {
            return null;
        }

        const index = Math.floor(Math.random() * this.SYSTEM_AI_VOICE_FILES.length);
        const file = this.SYSTEM_AI_VOICE_FILES[index];
        return `modules/${this.MODULE_ID}/template/sysai/${file}`;
    }

    /**
     * Воспроизводит короткий случайный System AI звук с ограничением частоты/перекрытия
     * @param {number} volume
     */
    static _playSystemAIVoice(volume) {
        const now = performance.now();
        if (now - this.lastSystemAIVoicePlayAt < this.SYSTEM_AI_MIN_INTERVAL_MS) return;
        if (this.activeTypingSounds.size >= this.SYSTEM_AI_MAX_CONCURRENT) return;

        const randomSystemAIVoice = this._getRandomSystemAIVoicePath();
        if (!randomSystemAIVoice) return;

        const randomSound = new Audio(randomSystemAIVoice);
        randomSound.playbackRate = 0.9 + Math.random() * 0.2;
        randomSound.volume = volume;
        this.activeTypingSounds.add(randomSound);
        this.lastSystemAIVoicePlayAt = now;

        const cleanup = () => {
            this.activeTypingSounds.delete(randomSound);
            randomSound.removeEventListener('ended', cleanup);
            randomSound.removeEventListener('error', cleanup);
        };

        randomSound.addEventListener('ended', cleanup, { once: true });
        randomSound.addEventListener('error', cleanup, { once: true });
        randomSound.play().catch(() => {
            cleanup();
        });
    }

    /**
     * Нормализует пути к ассетам после смены ID модуля
     * @param {string} path - Исходный путь
     * @returns {string} Нормализованный путь
     */
    static _normalizeAssetPath(path) {
        if (!path || typeof path !== 'string') return path;

        let normalized = path.trim();
        if (!normalized) return normalized;

        const legacy = this.LEGACY_MODULE_ID;
        const current = this.MODULE_ID;

        normalized = normalized
            .replace(`/modules/${legacy}/`, `/modules/${current}/`)
            .replace(`modules/${legacy}/`, `modules/${current}/`)
            .replace(`${legacy}/template/`, `modules/${current}/template/`);

        return normalized;
    }

    /**
     * Извлекает данные формы из диалога настроек коммуникатора
     * @param {HTMLFormElement} form
     * @returns {Object} Данные формы
     */
    static _extractFormData(form) {
        const typingSpeedInput = form.querySelector('#typing-speed-input');
        const typingSpeedValue = typingSpeedInput ? Number(typingSpeedInput.value) : null;
        const useGlobalSpeed = form.querySelector('#use-global-speed')?.checked ?? false;

        return {
            characterName: this._getFormValue(form, '#character-name'),
            portraitPath: this._normalizeAssetPath(this._getFormValue(form, '#portrait-path')),
            message: this._getFormValue(form, '#message-input'),
            soundPath: this._normalizeAssetPath(this._getFormValue(form, '#sound-path')),
            voiceoverPath: this._normalizeAssetPath(this._getFormValue(form, '#voiceover-path')),
            imagePath: this._normalizeAssetPath(this._getFormValue(form, '#image-path')),
            systemAIVoice: form.querySelector('#system-ai-voice')?.checked ?? game.settings.get('lancer-communicator-dcw', 'lastSystemAIVoice') ?? false,
            style: this._getFormValue(form, '#message-style'),
            fontFamily: this._getFormValue(form, '#font-family'),
            fontSize: Number(this._getFormValue(form, '#font-size-input')) || 18,
            typingSpeed: useGlobalSpeed ? null : typingSpeedValue,
            messageWidth: Number(this._getFormValue(form, '#message-width-input')) || 30,
            postToChat: form.querySelector('#post-to-chat')?.checked ?? game.settings.get('lancer-communicator-dcw', 'postToChat'),
            postImageToChat: form.querySelector('#post-image-to-chat')?.checked ?? game.settings.get('lancer-communicator-dcw', 'postImageToChat')
        };
    }

    /**
     * Валидирует данные формы для отправки сообщения
     * @param {Object} data - Данные формы
     * @param {boolean} requireMessage - Требовать ли наличие сообщения
     * @returns {boolean} Валидны ли данные
     */
    static _validateFormData(data, requireMessage = true) {
        if (!data.characterName.trim()) {
            ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.NoCharacterName'));
            return false;
        }
        if (!data.portraitPath) {
            data.portraitPath = 'icons/svg/mystery-man.svg';
        }
        if (requireMessage && !data.message.trim() && !data.imagePath) {
            ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.NoMessage'));
            return false;
        }
        return true;
    }

    /**
     * Проверяет, существует ли макрос с указанным именем
     * @param {string} name - Имя макроса
     * @returns {boolean}
     */
    static _isMacroNameTaken(name) {
        return game.macros.some(m => m.name === name);
    }

    /**
     * Создаёт обработчик FilePicker для выбора файлов
     * @param {HTMLInputElement} input - Поле ввода пути
     * @param {'image'|'audio'} type - Тип файла
     * @returns {void}
     */
    static _setupFilePicker(input, type) {
        const selectBtn = input.parentElement.querySelector(`[id^="select-"]`);
        const clearBtn = input.parentElement.querySelector(`[id^="clear-"]`);

        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                new FilePicker({
                    type,
                    current: input.value,
                    callback: async (path) => {
                        if (await this._validateFile(path)) {
                            input.value = path;
                        } else {
                            ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.FileNotFound'));
                        }
                    }
                }).browse();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                input.value = '';
            });
        }
    }

    /**
     * Вычисляет скорость печати на основе длительности аудиофайла и длины текста
     * @param {number} audioDuration - Длительность аудио в секундах
     * @param {number} textLength - Длина текста в символах
     * @returns {number} - Скорость печати (0-180)
     */
    static _calculateTypingSpeedFromAudio(audioDuration, textLength) {
        if (audioDuration <= 0 || textLength <= 0) {
            return this.settings.globalTypingSpeed;
        }

        // Вычисляем задержку на символ в мс
        const delayPerChar = (audioDuration * 1000) / textLength;
        this.debug(`Auto speed calculation: audio=${audioDuration}s, text=${textLength} chars, delay=${delayPerChar}ms/char`);

        // Базовая формула: delay = baseDelay - typingSpeed
        // baseDelay примерно 200 для обычных символов
        // Нам нужно: typingSpeed = baseDelay - delayPerChar
        // Но учитываем, что знаки препинания дают большую задержку
        const baseDelay = 200;
        let calculatedSpeed = Math.round(baseDelay - delayPerChar);

        // Ограничиваем диапазон
        calculatedSpeed = Math.max(50, Math.min(180, calculatedSpeed));

        this.debug(`Calculated typing speed: ${calculatedSpeed}`);
        return calculatedSpeed;
    }

    /**
     * Получает длительность аудиофайла
     * @param {string} audioPath - Путь к аудиофайлу
     * @returns {Promise<number>} - Длительность в секундах
     */
    static async _getAudioDuration(audioPath) {
        const normalizedPath = this._normalizeAssetPath(audioPath);
        return new Promise((resolve, reject) => {
            const audio = new Audio(normalizedPath);

            const onLoadedMetadata = () => {
                cleanup();
                const duration = audio.duration;
                this.debug(`Audio duration loaded: ${duration}s for ${normalizedPath}`);
                resolve(duration);
            };

            const onError = (e) => {
                cleanup();
                this.debug(`Failed to load audio: ${normalizedPath}`, e);
                reject(new Error('Failed to load audio'));
            };

            const cleanup = () => {
                audio.removeEventListener('loadedmetadata', onLoadedMetadata);
                audio.removeEventListener('error', onError);
            };

            audio.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
            audio.addEventListener('error', onError, { once: true });

            // Устанавливаем таймаут
            setTimeout(() => {
                cleanup();
                reject(new Error('Audio loading timeout'));
            }, 5000);
        });
    }

    // ─── DIALOG ────────────────────────────────────────────────────

    /**
     * Открывает диалоговое окно настроек коммуникатора
     */
    static async openCommunicatorSettings() {
        this._cacheSettings();

        const selectedToken = canvas.tokens.controlled[0];
        const lastPortrait = this._normalizeAssetPath(game.settings.get('lancer-communicator-dcw', 'lastPortrait'));
        let lastCharacterName = game.settings.get('lancer-communicator-dcw', 'lastCharacterName');
        const lastSound = this._normalizeAssetPath(game.settings.get('lancer-communicator-dcw', 'lastSound'));
        const lastVoiceover = this._normalizeAssetPath(game.settings.get('lancer-communicator-dcw', 'lastVoiceover'));
        const lastImage = this._normalizeAssetPath(game.settings.get('lancer-communicator-dcw', 'lastImage'));
        const lastSystemAIVoice = game.settings.get('lancer-communicator-dcw', 'lastSystemAIVoice') ?? false;
        const lastStyle = game.settings.get('lancer-communicator-dcw', 'lastMessageStyle') || 'undertale';
        const fontSize = game.settings.get('lancer-communicator-dcw', 'messageFontSize');
        const lastTypingSpeed = game.settings.get('lancer-communicator-dcw', 'lastTypingSpeed');
        const globalTypingSpeed = this.settings.globalTypingSpeed;
        const lastMessageWidth = game.settings.get('lancer-communicator-dcw', 'lastMessageWidth');
        const globalMessageWidth = this.settings.globalMessageWidth;

        if (selectedToken) {
            lastCharacterName = selectedToken.name;
        }

        const escapedCharName = this._escapeHtml(lastCharacterName || '');
        const escapedPortrait = this._escapeHtml(lastPortrait || '');

        const fontOptions = this.FONTS.map(f =>
            `<option value="${f}" ${this.settings.fontFamily === f ? 'selected' : ''}>${f}</option>`
        ).join('');

        const styleOptions = this.STYLES.map(s =>
            `<option value="${s.value}" ${lastStyle === s.value ? 'selected' : ''}>${game.i18n.localize(s.i18nKey) || s.value}</option>`
        ).join('');

        const typingSpeedValue = lastTypingSpeed ?? globalTypingSpeed;
        const useGlobalSpeed = lastTypingSpeed === null;

        new Dialog({
            title: game.i18n.localize('LANCER.Settings.CommunicatorSettings'),
            content: `
                <form class="lancer-communicator-dialog grid-2">
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.CharacterName')}</label>
                        <input type="text" id="character-name" value="${escapedCharName}" placeholder="${game.i18n.localize('LANCER.Settings.CharacterName')}">
                    </div>
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.Portrait')}</label>
                        <div class="lcm-input-group">
                            <input type="text" id="portrait-path" value="${escapedPortrait}" placeholder="${game.i18n.localize('LANCER.Settings.EnterPortraitURL')}">
                            <button type="button" id="select-portrait">${game.i18n.localize('LANCER.Settings.SelectFromLibrary')}</button>
                        </div>
                        <small class="lcm-hint">${game.i18n.localize('LANCER.Settings.PortraitHint')}</small>
                    </div>
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.MessageText')}</label>
                        <textarea id="message-input" rows="4" placeholder="${game.i18n.localize('LANCER.Settings.MessageText')}"></textarea>
                    </div>
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.SoundSelect')}</label>
                        <div class="lcm-input-group">
                            <input type="text" id="sound-path" value="${this._escapeHtml(lastSound || '')}" readonly placeholder="${game.i18n.localize('LANCER.Settings.SelectSound')}">
                            <button type="button" id="select-sound">${game.i18n.localize('LANCER.Settings.SelectSound')}</button>
                            <button type="button" id="clear-sound">${game.i18n.localize('LANCER.Settings.ClearSound')}</button>
                        </div>
                    </div>
                    <div class="lcm-form-group lcm-post-to-chat-row">
                        <label class="lcm-toggle-label">
                            <input type="checkbox" id="system-ai-voice" ${lastSystemAIVoice ? 'checked' : ''}>
                            <span>${game.i18n.localize('LANCER.Settings.SystemAIVoice')}</span>
                        </label>
                        <small class="lcm-hint">${game.i18n.localize('LANCER.Settings.SystemAIVoiceHint')}</small>
                    </div>
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.VoiceoverSelect')}</label>
                        <div class="lcm-input-group">
                            <input type="text" id="voiceover-path" value="${this._escapeHtml(lastVoiceover || '')}" readonly placeholder="${game.i18n.localize('LANCER.Settings.SelectVoiceover')}">
                            <button type="button" id="select-voiceover">${game.i18n.localize('LANCER.Settings.SelectVoiceover')}</button>
                            <button type="button" id="clear-voiceover">${game.i18n.localize('LANCER.Settings.ClearVoiceover')}</button>
                        </div>
                    </div>
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.ImageSelect')}</label>
                        <div class="lcm-input-group">
                            <input type="text" id="image-path" value="${this._escapeHtml(lastImage || '')}" readonly placeholder="${game.i18n.localize('LANCER.Settings.SelectImage')}">
                            <button type="button" id="select-image">${game.i18n.localize('LANCER.Settings.SelectImage')}</button>
                            <button type="button" id="clear-image">${game.i18n.localize('LANCER.Settings.ClearImage')}</button>
                        </div>
                    </div>
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.typingSpeed')} <small style="color:#999;">(${game.i18n.localize('LANCER.Settings.globalTypingSpeed')}: ${globalTypingSpeed})</small></label>
                        <div class="lcm-input-group" style="align-items:center;">
                            <input type="checkbox" id="use-global-speed" ${useGlobalSpeed ? 'checked' : ''}>
                            <label for="use-global-speed" style="font-weight:normal;font-size:12px;margin-bottom:0;">${game.i18n.localize('LANCER.Settings.useGlobalSpeed')}</label>
                        </div>
                        <div class="lcm-input-group" id="typing-speed-row" style="margin-top:5px;${useGlobalSpeed ? 'opacity:0.5;pointer-events:none;' : ''}">
                            <input type="range" id="typing-speed-input" min="50" max="180" step="10" value="${typingSpeedValue}">
                            <span id="typing-speed-display">${typingSpeedValue}</span>
                            <button type="button" id="auto-speed-btn" style="margin-left:5px;padding:2px 8px;font-size:11px;" title="${game.i18n.localize('LANCER.Settings.autoSpeedHint')}">${game.i18n.localize('LANCER.Settings.autoSpeed')}</button>
                        </div>
                        <small class="lcm-hint">${game.i18n.localize('LANCER.Settings.typingSpeedHint')}</small>
                    </div>
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.FontFamily')}</label>
                        <select id="font-family">${fontOptions}</select>
                    </div>
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.FontSize')}</label>
                        <div class="lcm-input-group">
                            <input type="range" id="font-size-input" min="10" max="32" step="1" value="${fontSize}">
                            <span id="font-size-display">${fontSize}px</span>
                        </div>
                    </div>
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.MessageWidth')}</label>
                        <div class="lcm-input-group">
                            <input type="range" id="message-width-input" min="20" max="90" step="5" value="${lastMessageWidth ?? globalMessageWidth ?? 30}">
                            <span id="message-width-display">${lastMessageWidth ?? globalMessageWidth ?? 30}%</span>
                        </div>
                    </div>
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.MessageStyle')}</label>
                        <select id="message-style">${styleOptions}</select>
                    </div>
                    <div class="lcm-form-group lcm-post-to-chat-row">
                        <label class="lcm-toggle-label">
                            <input type="checkbox" id="post-to-chat" ${game.settings.get('lancer-communicator-dcw', 'postToChat') ? 'checked' : ''}>
                            <span>${game.i18n.localize('LANCER.Settings.PostToChat')}</span>
                        </label>
                        <small class="lcm-hint">${game.i18n.localize('LANCER.Settings.PostToChatHint')}</small>
                    </div>
                    <div class="lcm-form-group lcm-post-to-chat-row">
                        <label class="lcm-toggle-label">
                            <input type="checkbox" id="post-image-to-chat" ${game.settings.get('lancer-communicator-dcw', 'postImageToChat') ? 'checked' : ''}>
                            <span>${game.i18n.localize('LANCER.Settings.PostImageToChat')}</span>
                        </label>
                        <small class="lcm-hint">${game.i18n.localize('LANCER.Settings.PostImageToChatHint')}</small>
                    </div>
                </form>
                <div id="style-preview" class="lcm-form-group" style="margin-top: 15px;"></div>
            `,
            buttons: {
                send: {
                    icon: '',
                    label: game.i18n.localize('LANCER.Settings.Send'),
                    callback: (html) => {
                        const data = this._extractFormData(html[0].querySelector('form'));
                        if (!this._validateFormData(data)) return false;

                        this._saveDialogSettings(data);
                        this.sendCommunicatorMessage(
                            data.characterName, data.portraitPath, data.message,
                            data.soundPath, data.voiceoverPath, data.imagePath, data.style,
                            data.fontSize, data.fontFamily, data.typingSpeed,
                            null, data.postToChat, data.postImageToChat, data.systemAIVoice
                        );
                    }
                },
                macro: {
                    icon: '',
                    label: game.i18n.localize('LANCER.Settings.CreateMacro'),
                    callback: async (html) => {
                        const data = this._extractFormData(html[0].querySelector('form'));
                        if (!this._validateFormData(data)) return false;

                        if (this._isMacroNameTaken(data.characterName)) {
                            ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.MacroAlreadyExists'));
                            return false;
                        }

                        await this.createCommunicatorMacro(
                            data.characterName, data.portraitPath, data.message,
                            data.soundPath, data.voiceoverPath, data.imagePath, data.style,
                            data.fontSize, data.fontFamily, data.typingSpeed, null, data.postImageToChat, data.systemAIVoice
                        );
                    }
                },
                quickMacro: {
                    icon: '',
                    label: game.i18n.localize('LANCER.Settings.CreateQuickMacro'),
                    callback: async (html) => {
                        const data = this._extractFormData(html[0].querySelector('form'));
                        if (!this._validateFormData(data, false)) return false;

                        if (this._isMacroNameTaken(`${data.characterName} Quick`)) {
                            ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.MacroAlreadyExists'));
                            return false;
                        }

                        await this.createQuickCommunicatorMacro(
                            data.characterName, data.portraitPath, data.soundPath,
                            data.voiceoverPath, data.imagePath, data.style, data.fontSize, data.fontFamily, data.typingSpeed, null, data.postImageToChat, data.systemAIVoice
                        );
                    }
                },
                cancel: {
                    icon: '',
                    label: game.i18n.localize('LANCER.Settings.Cancel')
                }
            },
            default: 'send',
            render: (html) => this._renderDialogHandlers(html),
            close: (html) => this._closeDialogHandler(html)
        }, { width: 900, height: 700, classes: ['dialog', 'lancer-communicator-dialog'] }).render(true);
    }

    /**
     * Настраивает обработчики событий внутри диалога
     * @param {jQuery} html - jQuery-обёртка диалога
     */
    static _renderDialogHandlers(html) {
        const dialog = html[0];

        // FilePicker для портрета
        const portraitInput = dialog.querySelector('#portrait-path');
        dialog.querySelector('#select-portrait').addEventListener('click', () => {
            new FilePicker({
                type: 'image',
                current: portraitInput.value,
                callback: async (path) => {
                    if (await this._validateFile(path)) {
                        portraitInput.value = path;
                    } else {
                        ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.FileNotFound'));
                    }
                }
            }).browse();
        });

        // FilePicker для звука и озвучки и картинки
        this._setupFilePicker(dialog.querySelector('#sound-path'), 'audio');
        this._setupFilePicker(dialog.querySelector('#voiceover-path'), 'audio');
        this._setupFilePicker(dialog.querySelector('#image-path'), 'image');

        const systemAIVoiceCheckbox = dialog.querySelector('#system-ai-voice');
        const soundPathInput = dialog.querySelector('#sound-path');
        const selectSoundBtn = dialog.querySelector('#select-sound');
        const clearSoundBtn = dialog.querySelector('#clear-sound');

        const updateSoundControlsState = () => {
            const disabled = systemAIVoiceCheckbox?.checked ?? false;
            if (soundPathInput) {
                soundPathInput.disabled = disabled;
                soundPathInput.style.opacity = disabled ? '0.6' : '1';
            }
            if (selectSoundBtn) selectSoundBtn.disabled = disabled;
            if (clearSoundBtn) clearSoundBtn.disabled = disabled;
        };

        systemAIVoiceCheckbox?.addEventListener('change', updateSoundControlsState);
        updateSoundControlsState();

        // Обработчик чекбокса "Использовать глобальную скорость"
        const useGlobalCheckbox = dialog.querySelector('#use-global-speed');
        const typingSpeedRow = dialog.querySelector('#typing-speed-row');
        const typingSpeedInput = dialog.querySelector('#typing-speed-input');
        const typingSpeedDisplay = dialog.querySelector('#typing-speed-display');

        useGlobalCheckbox.addEventListener('change', () => {
            if (useGlobalCheckbox.checked) {
                typingSpeedRow.style.opacity = '0.5';
                typingSpeedRow.style.pointerEvents = 'none';
            } else {
                typingSpeedRow.style.opacity = '1';
                typingSpeedRow.style.pointerEvents = 'auto';
            }
        });

        // Обновление отображения скорости печати
        typingSpeedInput.addEventListener('input', () => {
            typingSpeedDisplay.textContent = typingSpeedInput.value;
        });

        // Кнопка "Авто" для автоматического расчёта скорости
        const autoSpeedBtn = dialog.querySelector('#auto-speed-btn');
        const voiceoverInput = dialog.querySelector('#voiceover-path');
        const messageInput = dialog.querySelector('#message-input');

        autoSpeedBtn.addEventListener('click', async () => {
            const voiceoverPath = voiceoverInput.value;
            const messageText = messageInput.value;

            if (!voiceoverPath) {
                ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.NoVoiceoverForAuto'));
                return;
            }

            if (!messageText || messageText.trim().length === 0) {
                ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.NoMessageForAuto'));
                return;
            }

            try {
                autoSpeedBtn.disabled = true;
                autoSpeedBtn.textContent = '...';

                const duration = await this._getAudioDuration(voiceoverPath);

                // Проверка минимальной длительности озвучки (3 секунды)
                if (duration < 3) {
                    ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.VoiceoverTooShort'));
                    autoSpeedBtn.disabled = false;
                    autoSpeedBtn.textContent = game.i18n.localize('LANCER.Settings.autoSpeed');
                    return;
                }

                const textLength = messageText.trim().length;
                const calculatedSpeed = this._calculateTypingSpeedFromAudio(duration, textLength);

                // Снимаем галочку "Использовать глобальную скорость"
                useGlobalCheckbox.checked = false;
                typingSpeedRow.style.opacity = '1';
                typingSpeedRow.style.pointerEvents = 'auto';

                // Устанавливаем вычисленную скорость
                typingSpeedInput.value = calculatedSpeed;
                typingSpeedDisplay.textContent = calculatedSpeed;

                this.debug(`Auto speed set to ${calculatedSpeed} based on ${duration}s audio and ${textLength} chars`);
            } catch (error) {
                this.debug('Failed to calculate auto speed:', error);
                ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.AutoSpeedFailed'));
            } finally {
                autoSpeedBtn.disabled = false;
                autoSpeedBtn.textContent = game.i18n.localize('LANCER.Settings.autoSpeed');
            }
        });

        // Обработчик изменения шрифта
        const fontFamilySelect = dialog.querySelector('#font-family');
        fontFamilySelect.addEventListener('change', () => {
            document.documentElement.style.setProperty('--message-font', fontFamilySelect.value);
            updatePreview();
        });

        // Обновление отображения размера шрифта
        const fontSizeInput = dialog.querySelector('#font-size-input');
        const fontSizeDisplay = dialog.querySelector('#font-size-display');
        fontSizeInput.addEventListener('input', () => {
            const size = Number(fontSizeInput.value);
            fontSizeDisplay.textContent = `${size}px`;
            document.documentElement.style.setProperty('--message-font-size', `${size}px`);
        });

        // Обновление отображения ширины окна сообщения
        const messageWidthInput = dialog.querySelector('#message-width-input');
        const messageWidthDisplay = dialog.querySelector('#message-width-display');
        messageWidthInput.addEventListener('input', () => {
            const width = Number(messageWidthInput.value);
            messageWidthDisplay.textContent = `${width}%`;
            document.documentElement.style.setProperty('--message-width', `${width}%`);
            document.documentElement.style.setProperty('--message-left', `${(100 - width) / 2}%`);
        });

        // Предпросмотр стилей
        const styleSelect = dialog.querySelector('#message-style');
        const preview = dialog.querySelector('#style-preview');

        function updatePreview() {
            const selectedStyle = styleSelect.value;
            preview.innerHTML = '';

            const previewContent = document.createElement('div');
            previewContent.className = `lcm-communicator-container style-${selectedStyle}`;
            previewContent.style.cssText = 'padding:10px;border-radius:5px;margin:10px 0;display:flex;';
            previewContent.innerHTML = `
                <div style="flex-shrink:0;width:50px;height:50px;background:#555;border-radius:5px;margin-right:10px"></div>
                <div style="flex-grow:1;font-family:var(--message-font);font-size:var(--message-font-size);">
                    ${game.i18n.localize('LANCER.Settings.MessageStyle')} - ${styleSelect.options[styleSelect.selectedIndex].text}
                </div>
            `;

            const stylePresets = {
                green: { color: 'green', border: '1px solid #03FB8D', boxShadow: '0 0 5px rgba(3,251,141,0.5)', bg: 'rgba(0,255,0,0.1)' },
                blue: { color: '#00A4FF', border: '1px solid #00A4FF', boxShadow: '0 0 5px rgba(0,164,255,0.5)', bg: 'rgba(0,0,255,0.1)' },
                red: { color: '#FF0000', border: '1px solid #FF0000', boxShadow: '0 0 5px rgba(255,0,0,0.5)', bg: 'rgba(255,0,0,0.1)' },
                yellow: { color: '#FFD700', border: '1px solid #FFD700', boxShadow: '0 0 5px rgba(255,215,0,0.5)', bg: 'rgba(255,255,0,0.1)' },
                damaged: { color: 'darkred', border: '1px solid maroon', boxShadow: '0 0 5px rgba(255,0,0,0.5)', bg: 'rgba(128,0,0,0.1)' },
                undertale: { color: 'white', border: '2px solid white', boxShadow: '0 0 10px rgba(255,255,255,0.5)', bg: 'rgba(0,0,0,0.95)' }
            };

            const preset = stylePresets[selectedStyle] || stylePresets.green;
            previewContent.style.color = preset.color;
            previewContent.style.border = preset.border;
            previewContent.style.boxShadow = preset.boxShadow;
            previewContent.style.backgroundColor = preset.bg;

            if (selectedStyle === 'damaged') {
                previewContent.style.animation = 'shake-border 0.7s infinite';
            }

            preview.appendChild(previewContent);
        }

        styleSelect.addEventListener('change', updatePreview);
        updatePreview();
    }

    /**
     * Сохраняет настройки из диалога
     * @param {Object} data - Данные формы
     */
    static _saveDialogSettings(data) {
        game.settings.set('lancer-communicator-dcw', 'lastCharacterName', data.characterName);
        game.settings.set('lancer-communicator-dcw', 'lastPortrait', this._normalizeAssetPath(data.portraitPath));
        game.settings.set('lancer-communicator-dcw', 'lastSound', this._normalizeAssetPath(data.soundPath));
        game.settings.set('lancer-communicator-dcw', 'lastImage', this._normalizeAssetPath(data.imagePath));
        game.settings.set('lancer-communicator-dcw', 'lastSystemAIVoice', !!data.systemAIVoice);
        game.settings.set('lancer-communicator-dcw', 'lastMessageStyle', data.style);
        game.settings.set('lancer-communicator-dcw', 'fontFamily', data.fontFamily);
        game.settings.set('lancer-communicator-dcw', 'lastTypingSpeed', data.typingSpeed);
        game.settings.set('lancer-communicator-dcw', 'lastMessageWidth', data.messageWidth);
    }

    /**
     * Обработчик закрытия диалога — сохраняет настройки
     * @param {jQuery} html - jQuery-обёртка диалога
     */
    static _closeDialogHandler(html) {
        const formElement = html[0]?.querySelector('form');
        if (!formElement) return;

        const fontSize = Number(formElement.querySelector('#font-size-input')?.value || 18);
        if (fontSize >= 10 && fontSize <= 32) {
            game.settings.set('lancer-communicator-dcw', 'messageFontSize', fontSize)
                .catch(err => console.error('Lancer Communicator | Error saving font size:', err));
        }

        const messageWidth = Number(formElement.querySelector('#message-width-input')?.value || 30);
        if (messageWidth >= 20 && messageWidth <= 90) {
            game.settings.set('lancer-communicator-dcw', 'lastMessageWidth', messageWidth)
                .catch(err => console.error('Lancer Communicator | Error saving message width:', err));
        }

        const voiceoverPath = this._normalizeAssetPath(this._getFormValue(formElement, '#voiceover-path'));
        game.settings.set('lancer-communicator-dcw', 'lastVoiceover', voiceoverPath);

        const systemAIVoice = formElement.querySelector('#system-ai-voice')?.checked ?? false;
        game.settings.set('lancer-communicator-dcw', 'lastSystemAIVoice', systemAIVoice);

        const postImageToChat = formElement.querySelector('#post-image-to-chat')?.checked;
        if (postImageToChat !== undefined) game.settings.set('lancer-communicator-dcw', 'postImageToChat', postImageToChat);
    }

    // ─── MESSAGING ─────────────────────────────────────────────────

    /**
     * Отправляет сообщение коммуникатора всем подключённым клиентам
     * @param {string} characterName - Имя персонажа
     * @param {string} portraitPath - Путь к изображению портрета
     * @param {string} message - Текст сообщения
     * @param {string} soundPath - Путь к звуковому файлу (опционально)
     * @param {string} voiceoverPath - Путь к файлу озвучки (опционально)
     * @param {string} style - Стиль сообщения
     * @param {number} fontSize - Размер шрифта в пикселях
     * @param {string|null} fontFamily - Семейство шрифта
     * @param {number|null} typingSpeed - Скорость печати (null = глобальная)
     */
    static sendCommunicatorMessage(characterName, portraitPath, message, soundPath = '', voiceoverPath = '', imagePath = '', style = 'undertale', fontSize = 18, fontFamily = null, typingSpeed = null, messageWidth = null, postToChat = null, postImageToChat = null, systemAIVoice = false) {
        const effectiveFont = fontFamily || this.settings.fontFamily;
        const effectiveTypingSpeed = this._getEffectiveTypingSpeed(typingSpeed);
        const effectiveWidth = messageWidth || this.settings.globalMessageWidth || 30;
        const effectivePortrait = this._normalizeAssetPath(portraitPath) || 'icons/svg/mystery-man.svg';
        const normalizedSoundPath = this._normalizeAssetPath(soundPath);
        const normalizedVoiceoverPath = this._normalizeAssetPath(voiceoverPath);
        const normalizedImagePath = this._normalizeAssetPath(imagePath);

        const messageData = {
            characterName,
            portraitPath: effectivePortrait,
            message,
            soundPath: normalizedSoundPath,
            voiceoverPath: normalizedVoiceoverPath,
            imagePath: normalizedImagePath,
            style,
            fontSize,
            fontFamily: effectiveFont,
            typingSpeed: effectiveTypingSpeed,
            messageWidth: effectiveWidth,
            postImageToChat,
            systemAIVoice: !!systemAIVoice,
            senderId: game.user.id,
            timestamp: new Date().toISOString()
        };

        this.debug('Sending message:', messageData);

        // Сохраняем сообщение для последующего экспорта
        this.savedMessages.push(messageData);

        // Показываем локально
        this.showCommunicatorMessage(messageData).catch(console.error);
        // Отправляем остальным клиентам
        game.socket.emit('module.lancer-communicator-dcw', {
            type: 'showMessage',
            data: messageData
        });
        this._postToChat(messageData, postToChat);
    }

    /**
     * Безопасно подготавливает текст для рендера в чате
     * @param {string} text - Исходный текст
     * @returns {string} HTML с сохранёнными переносами
     */
    static _applyTextShake(text) {
        return String(text)
            .split(/\r?\n/)
            .map(line => line.split(/<br\s*\/?>/i).map(seg => this._escapeHtml(seg)).join('<br>'))
            .join('\n');
    }

    /**
     * Отправляет копию сообщения коммуникатора в чат Foundry
     * @param {Object} data - Данные сообщения
     */
    static async _postToChat(data, postToChatOverride = null) {
        const enabled = postToChatOverride !== null ? postToChatOverride : game.settings.get('lancer-communicator-dcw', 'postToChat');
        if (!enabled) return;

        const { characterName, portraitPath, message, style, fontFamily, imagePath, postImageToChat } = data;

        const stylePresets = {
            green: {
                nameColor: '#03FB8D', textColor: 'green',
                border: '1px solid #03FB8D',
                shadow: '0 0 15px rgba(3,251,141,0.8)',
                portraitBorder: '1px solid #03FB8D',
                portraitShadow: '0 0 10px rgba(3,251,141,0.5)'
            },
            blue: {
                nameColor: '#00A4FF', textColor: '#00A4FF',
                border: '1px solid #00A4FF',
                shadow: '0 0 15px rgba(0,164,255,0.8)',
                portraitBorder: '1px solid #00A4FF',
                portraitShadow: '0 0 10px rgba(0,164,255,0.5)'
            },
            yellow: {
                nameColor: '#FFD700', textColor: '#FFD700',
                border: '1px solid #FFD700',
                shadow: '0 0 15px rgba(255,215,0,0.8)',
                portraitBorder: '1px solid #FFD700',
                portraitShadow: '0 0 10px rgba(255,215,0,0.5)'
            },
            red: {
                nameColor: '#FF0000', textColor: '#FF0000',
                border: '1px solid #FF0000',
                shadow: '0 0 15px rgba(255,0,0,0.8)',
                portraitBorder: '1px solid #FF0000',
                portraitShadow: '0 0 10px rgba(255,0,0,0.5)'
            },
            damaged: {
                nameColor: '#FF2222', textColor: '#FF4444',
                border: '2px solid darkred',
                shadow: '0 0 15px rgba(255,0,0,0.8)',
                portraitBorder: '2px solid darkred',
                portraitShadow: '0 0 5px rgba(255,0,0,0.3), 1px 1px 3px rgba(255,0,0,0.2)',
                nameShadow: '1px 1px 2px rgba(255,0,0,0.5)',
                textShadow: '2px 2px 4px rgba(255,0,0,0.5)'
            },
            undertale: {
                nameColor: 'white', textColor: 'white',
                border: '2px solid white',
                shadow: '0 0 10px rgba(255,255,255,0.5)',
                portraitBorder: '2px solid white',
                portraitShadow: '0 0 10px rgba(255,255,0,0.5)'
            }
        };

        const p = stylePresets[style] || stylePresets.green;
        const font = fontFamily || this.settings.fontFamily;
        const isDamaged = style === 'damaged';
        const nameShadow = p.nameShadow ? `text-shadow:${p.nameShadow};` : '';
        const textShadow = p.textShadow ? `text-shadow:${p.textShadow};` : '';

        const imageHtml = (imagePath && (postImageToChat ?? game.settings.get('lancer-communicator-dcw', 'postImageToChat')))
            ? `<div style="margin-top:8px;text-align:center;"><img src="${this._escapeHtml(imagePath)}" onclick="new ImagePopout(this.getAttribute('src')).render(true);" style="max-width:400px; max-height:400px; width:100%; object-fit:contain; border-radius:5px; border:${p.border}; box-shadow:${p.shadow}; cursor:pointer; ${isDamaged ? 'filter:contrast(120%) brightness(110%);' : ''}" alt="Attached Image"></div>`
            : '';

        const content = `<div class="lcm-chat-card${isDamaged ? ' style-damaged' : ''}" style="border:${p.border};box-shadow:${p.shadow};background-color:rgba(0,0,0,0.8);border-radius:5px;padding:8px;display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;align-items:flex-start;gap:10px;">
                <img src="${this._escapeHtml(portraitPath)}" style="width:50px;height:50px;object-fit:cover;border-radius:5px;border:${p.portraitBorder};box-shadow:${p.portraitShadow};flex-shrink:0;${isDamaged ? 'transform:skew(-5deg);filter:contrast(120%) brightness(110%);' : ''}" alt="${this._escapeHtml(characterName)}">
                <div style="flex-grow:1;min-width:0;">
                    <div class="lcm-chat-name" style="font-size:20px;font-weight:bold;color:${p.nameColor};${nameShadow}margin-bottom:4px;text-transform:uppercase;font-family:'${font}',monospace;">${this._escapeHtml(characterName)}</div>
                    <div class="lcm-chat-text" style="color:${p.textColor};${textShadow}font-size:14px;word-wrap:break-word;white-space:pre-wrap;font-family:'${font}',monospace;">${this._applyTextShake(message)}</div>
                </div>
            </div>
            ${imageHtml}
        </div>`;

        try {
            await ChatMessage.create({
                content,
                speaker: { alias: characterName }
            });
            this.debug('Chat message posted');
        } catch (error) {
            console.error('Lancer Communicator | Failed to post chat message:', error);
        }
    }

    /**
     * Отображает анимированное сообщение коммуникатора на экране
     * @param {Object} data - Данные сообщения
     * @returns {Promise<void>}
     */
    static async showCommunicatorMessage(data) {
        const { characterName, portraitPath, message = '', soundPath, voiceoverPath, imagePath, style, fontSize, fontFamily, typingSpeed, messageWidth, systemAIVoice = false } = data;
        const normalizedPortraitPath = this._normalizeAssetPath(portraitPath);
        const normalizedSoundPath = this._normalizeAssetPath(soundPath);
        const normalizedVoiceoverPath = this._normalizeAssetPath(voiceoverPath);
        const normalizedImagePath = this._normalizeAssetPath(imagePath);

        this.debug('Showing message:', { characterName, message: message?.substring(0, 50) + '...', typingSpeed });

        // Прерываем текущее сообщение, если оно есть
        this._stopCurrentMessage();

        // Кэшируем настройки, используемые в цикле
        this._cacheSettings();
        const effectiveTypingSpeed = this._getEffectiveTypingSpeed(typingSpeed);
        const { voiceVolume } = this.settings;

        // Создаём DOM
        const container = document.createElement('div');
        container.id = 'lancer-communicator-message';
        container.className = `top-screen style-${style || 'undertale'}`;

        container.innerHTML = `
            <div class="lcm-communicator-container">
                <div class="lcm-portrait-container">
                    <img class="lcm-portrait" src="${this._escapeHtml(normalizedPortraitPath)}" alt="${this._escapeHtml(characterName)}">
                    <div class="lcm-character-name">${this._escapeHtml(characterName)}</div>
                </div>
                <div style="flex-grow:1; display:flex; flex-direction:column; min-width:0;">
                    <div class="lcm-message-text"></div>
                    ${normalizedImagePath ? `<img class="lcm-message-image" src="${this._escapeHtml(normalizedImagePath)}" onclick="new ImagePopout(this.getAttribute('src')).render(true);" style="display:none; max-width:400px; max-height:400px; object-fit:contain; align-self:flex-start; border-radius:5px; margin-top:10px; cursor:pointer;" alt="Attached Image">` : ''}
                </div>
            </div>
        `;

        document.body.appendChild(container);
        this.currentContainer = container; // Сохраняем ссылку

        const messageTextEl = container.querySelector('.lcm-message-text');

        // CSS-переменные для шрифта и ширины
        if (typeof fontSize === 'number') {
            container.style.setProperty('--message-font-size', `${fontSize}px`);
        }
        container.style.setProperty('--message-font', fontFamily || this.settings.fontFamily);

        const effectiveWidth = messageWidth || this.settings.globalMessageWidth || 30;
        container.style.setProperty('--message-width', `${effectiveWidth}%`);
        container.style.setProperty('--message-left', `${(100 - effectiveWidth) / 2}%`);

        // Предзагрузка аудио
        let soundInstance = null;
        let voiceoverAudio = null; // Отдельная ссылка на озвучку

        if (normalizedVoiceoverPath) {
            try {
                const clampedVolume = Math.min(voiceVolume + 0.2, 1.0);
                voiceoverAudio = new Audio(normalizedVoiceoverPath);
                voiceoverAudio.volume = clampedVolume;

                await this._waitForAudio(voiceoverAudio, 5000);
                voiceoverAudio.play();
                this.currentAudio = voiceoverAudio; // Сохраняем ссылку на активное аудио
            } catch (error) {
                console.error('Lancer Communicator | Voiceover error:', error);
                voiceoverAudio = null;
            }
        }

        if (normalizedSoundPath && !normalizedVoiceoverPath && !systemAIVoice) {
            try {
                soundInstance = new Audio(normalizedSoundPath);
                await this._waitForAudio(soundInstance, 2000);
            } catch (error) {
                console.error('Lancer Communicator | Sound preload error:', error);
                soundInstance = null;
            }
        }

        // Эффект печатной машинки
        const punctuationPattern = /[\.,!?;:]/;
        const sentenceEndPattern = /[.!?]/;
        const silentCharPattern = /[\s\.,!?;:-]/;
        const sentencePauseDelay = Math.max(0, Number(this.settings.sentencePauseDelay) || 0);

        return new Promise((resolve) => {
            let i = 0;

            const typeWriter = async () => {
                if (i < message.length) {
                    const remaining = message.substring(i);
                    const brMatch = remaining.match(/^<br\s*\/?>/i);
                    if (brMatch) {
                        messageTextEl.appendChild(document.createElement('br'));
                        i += brMatch[0].length;
                        const delay = Math.max(100 - effectiveTypingSpeed, 10);
                        setTimeout(typeWriter, delay);
                        return;
                    }

                    const currentChar = message.charAt(i);
                    i++;

                    if (currentChar === '\n') {
                        messageTextEl.appendChild(document.createElement('br'));
                        const delay = Math.max(100 - effectiveTypingSpeed, 10);
                        setTimeout(typeWriter, delay);
                        return;
                    }

                    messageTextEl.appendChild(document.createTextNode(currentChar));

                    // Звук на каждый символ (если нет озвучки)
                    if (!voiceoverAudio && !silentCharPattern.test(currentChar)) {
                        if (systemAIVoice) {
                            this._playSystemAIVoice(voiceVolume);
                        } else if (soundInstance) {
                            soundInstance.currentTime = 0;
                            soundInstance.playbackRate = 0.85 + Math.random() * 0.3;
                            soundInstance.volume = voiceVolume;
                            try {
                                await soundInstance.play();
                            } catch (e) {
                                // Игнорируем ошибки автовоспроизведения
                            }
                        }
                    }

                    // Задержка: знаки препинания — дольше, остальные — по скорости
                    const baseDelay = punctuationPattern.test(currentChar) ? 350 : 200;
                    const nextVisibleChar = (i < message.length) ? message.charAt(i) : '';
                    const shouldApplySentencePause = sentenceEndPattern.test(currentChar)
                        && !sentenceEndPattern.test(nextVisibleChar)
                        && sentencePauseDelay > 0;
                    const delay = Math.max(baseDelay - effectiveTypingSpeed, 10)
                        + (shouldApplySentencePause ? sentencePauseDelay : 0);
                    setTimeout(typeWriter, delay);
                } else {
                    // Сообщение завершено — затухаем только звук набора (не озвучку!)
                    if (soundInstance) {
                        this._fadeOutAudio(soundInstance, 800);
                    }

                    // Показываем картинку если есть
                    const imageEl = container.querySelector('.lcm-message-image');
                    if (imageEl) {
                        imageEl.style.display = 'block';
                    }

                    // Ждём завершения озвучки + 3 секунды паузы перед закрытием рамки
                    const startCollapsing = () => {
                        // Очищаем ссылки перед удалением
                        this.currentAudio = null;
                        this.currentContainer = null;
                        container.classList.add('collapsing');
                        setTimeout(() => container.remove(), 3000);
                        resolve();
                    };

                    const startCollapsingWithPause = () => {
                        // 3 секунды паузы после окончания озвучки
                        setTimeout(startCollapsing, 3000);
                    };

                    if (voiceoverAudio && !voiceoverAudio.paused) {
                        // Ждём завершения озвучки, потом пауза 3 сек, потом схлопывание
                        voiceoverAudio.addEventListener('ended', startCollapsingWithPause, { once: true });
                    } else {
                        // Если озвучки нет — пауза 3 сек и схлопываем
                        setTimeout(startCollapsing, 3000);
                    }
                }
            };

            typeWriter();
        });
    }

    /**
     * Плавно затухает звук за указанное время
     * @param {HTMLAudioElement} audio
     * @param {number} durationMs - Длительность затухания в миллисекундах
     */
    static _fadeOutAudio(audio, durationMs = 800) {
        if (!audio || audio.paused) return;
        const startVolume = audio.volume;
        const steps = 20;
        const stepTime = durationMs / steps;
        let step = 0;

        const tick = () => {
            step++;
            if (step >= steps || audio.paused) {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = startVolume;
                return;
            }
            audio.volume = Math.max(startVolume * (1 - step / steps), 0);
            setTimeout(tick, stepTime);
        };
        tick();
    }

    /**
     * Ожидает готовности аудио к воспроизведению
     * @param {HTMLAudioElement} audio
     * @param {number} timeoutMs - Таймаут в миллисекундах
     * @returns {Promise<void>}
     */
    static _waitForAudio(audio, timeoutMs = 2000) {
        return new Promise((resolve, reject) => {
            const onReady = () => {
                cleanup();
                resolve();
            };
            const onError = () => {
                cleanup();
                reject(new Error(`Audio failed to load: ${audio.src}`));
            };
            const cleanup = () => {
                audio.removeEventListener('canplaythrough', onReady);
                audio.removeEventListener('error', onError);
                clearTimeout(timer);
            };
            const timer = setTimeout(onReady, timeoutMs);

            audio.addEventListener('canplaythrough', onReady, { once: true });
            audio.addEventListener('error', onError, { once: true });
        });
    }

    // ─── MACROS ────────────────────────────────────────────────────

    /**
     * Создаёт макрос для отправки сообщения коммуникатора
     */
    static async createCommunicatorMacro(characterName, portraitPath, message, soundPath, voiceoverPath, imagePath, style, fontSize, fontFamily = null, typingSpeed = null, messageWidth = null, postImageToChat = null, systemAIVoice = false) {
        if (!game.user.can('MACRO_SCRIPT')) {
            ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.CreateMacroTextPerm'));
            return;
        }

        const escapedName = this._escapeHtml(characterName);
        const typingSpeedArg = typingSpeed !== null ? typingSpeed : 'null';
        const messageWidthArg = messageWidth !== null ? messageWidth : 'null';
        const postImageToChatArg = postImageToChat !== null ? postImageToChat : 'null';

        new Dialog({
            title: game.i18n.localize('LANCER.Settings.CreateMacroName'),
            content: `
                <form class="lancer-communicator-dialog">
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.MacroNameLabel')}</label>
                        <input type="text" id="macro-name-input" value="${escapedName} Message" style="width:100%">
                    </div>
                </form>
            `,
            buttons: {
                create: {
                    icon: '',
                    label: game.i18n.localize('LANCER.Settings.Create'),
                    callback: (html) => {
                        const macroName = html[0].querySelector('#macro-name-input').value.trim();
                        if (!macroName) {
                            ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.CreateMacroTextInt'));
                            return;
                        }
                        if (this._isMacroNameTaken(macroName)) {
                            ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.MacroAlreadyExists'));
                            return;
                        }

                        const safeCharacterName = JSON.stringify(characterName);
                        const safePortraitPath = JSON.stringify(portraitPath);
                        const safeMessage = JSON.stringify(message);
                        const safeSoundPath = JSON.stringify(soundPath);
                        const safeVoiceoverPath = JSON.stringify(voiceoverPath);
                        const safeImagePath = JSON.stringify(imagePath);
                        const safeStyle = JSON.stringify(style);
                        const safeFontFamily = JSON.stringify(fontFamily || '');
                        const safeSystemAIVoice = JSON.stringify(!!systemAIVoice);
                        const commandText = `// Lancer Communicator Macro
                        const lcmApi = game.modules.get('lancer-communicator-dcw')?.api;
                        if (!lcmApi?.sendCommunicatorMessage) {
                            ui.notifications.error('Lancer Communicator API is unavailable. Try reloading the world.');
                            return;
                        }
                        lcmApi.sendCommunicatorMessage(
                            ${safeCharacterName},
                            ${safePortraitPath},
                            ${safeMessage},
                            ${safeSoundPath},
                            ${safeVoiceoverPath},
                            ${safeImagePath},
                            ${safeStyle},
                            ${fontSize},
                            ${safeFontFamily},
                            ${typingSpeedArg},
                            ${messageWidthArg},
                            null,
                            ${postImageToChatArg},
                            ${safeSystemAIVoice}
                        );`;

                        Macro.create({
                            name: macroName,
                            type: 'script',
                            command: commandText,
                            img: portraitPath
                        }).then(() => {
                            ui.notifications.info(game.i18n.format('LANCER.Settings.Notifications.MacroCreated', { name: macroName }));
                        }).catch(error => {
                            ui.notifications.error(game.i18n.format('LANCER.Settings.Notifications.MacroError', { error }));
                            console.error('Lancer Communicator | Macro creation error:', error);
                        });
                    }
                },
                cancel: {
                    icon: '',
                    label: game.i18n.localize('LANCER.Settings.Cancel')
                }
            },
            default: 'create'
        }, { classes: ['dialog', 'lancer-communicator-dialog'] }).render(true);
    }

    /**
     * Создаёт быстрый макрос коммуникатора с запросом сообщения при запуске
     */
    static async createQuickCommunicatorMacro(characterName, portraitPath, soundPath, voiceoverPath, imagePath, style, fontSize, fontFamily = null, typingSpeed = null, messageWidth = null, postImageToChat = null, systemAIVoice = false) {
        if (!game.user.can('MACRO_SCRIPT')) {
            ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.CreateMacroTextPerm'));
            return;
        }

        const escapedName = this._escapeHtml(characterName);
        const typingSpeedArg = typingSpeed !== null ? typingSpeed : 'null';
        const messageWidthArg = messageWidth !== null ? messageWidth : 'null';
        const postImageToChatArg = postImageToChat !== null ? postImageToChat : 'null';
        const systemAIVoiceArg = !!systemAIVoice;
        const globalTypingSpeed = game.settings.get('lancer-communicator-dcw', 'globalTypingSpeed');
        const globalMessageWidth = game.settings.get('lancer-communicator-dcw', 'globalMessageWidth') || 30;

        // Генерируем опции стилей для селекта
        const styleOptions = this.STYLES.map(s =>
            `<option value="${s.value}" ${style === s.value ? 'selected' : ''}>${game.i18n.localize(s.i18nKey) || s.value}</option>`
        ).join('');

        new Dialog({
            title: game.i18n.localize('LANCER.Settings.CreateQuickMacroName'),
            content: `
                <form class="lancer-communicator-dialog">
                    <div class="lcm-form-group">
                        <label>${game.i18n.localize('LANCER.Settings.MacroNameLabel')}</label>
                        <input type="text" id="quick-macro-name-input" value="${escapedName} Quick" style="width:100%">
                    </div>
                </form>
            `,
            buttons: {
                create: {
                    icon: '',
                    label: game.i18n.localize('LANCER.Settings.Create'),
                    callback: (html) => {
                        const macroName = html[0].querySelector('#quick-macro-name-input').value.trim();
                        if (!macroName) {
                            ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.CreateMacroTextInt'));
                            return;
                        }
                        if (this._isMacroNameTaken(macroName)) {
                            ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.MacroAlreadyExists'));
                            return;
                        }

                        // Экранируем строки для вставки в шаблон
                        const escapedCharName = characterName.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`');
                        const escapedPortraitPath = portraitPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`');
                        const escapedSoundPath = soundPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`');
                        const escapedVoiceoverPath = voiceoverPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`');
                        const escapedImagePath = imagePath.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/`/g, '\\`');

                        const commandText = `// Lancer Communicator Quick Macro
(async () => {
    const globalTypingSpeed = game.settings.get('lancer-communicator-dcw', 'globalTypingSpeed');
    const defaultFontSize = game.settings.get('lancer-communicator-dcw', 'messageFontSize') || ${fontSize};
    const defaultMessageWidth = game.settings.get('lancer-communicator-dcw', 'lastMessageWidth') || ${messageWidthArg !== 'null' ? messageWidthArg : globalMessageWidth};
    
    const styleOptions = \`${styleOptions}\`;
    
    let result = await new Promise((resolve) => {
        new Dialog({
            title: "${escapedCharName}",
            content: \`
                <form class="lancer-communicator-dialog">
                    <div class="lcm-form-group">
                        <label>\${game.i18n.localize('LANCER.Settings.MessageText')}</label>
                        <textarea id="quickMessageInput" rows="4" style="width:100%"></textarea>
                    </div>
                    <div class="lcm-form-group">
                        <label>\${game.i18n.localize('LANCER.Settings.typingSpeed')} <small style="color:#999;">(\\ \${game.i18n.localize('LANCER.Settings.globalTypingSpeed')}: \\ \${globalTypingSpeed})</small></label>
                        <div class="lcm-input-group" style="align-items:center;">
                            <input type="checkbox" id="quick-use-global-speed" checked style="width:auto;margin-right:5px;">
                            <label for="quick-use-global-speed" style="font-weight:normal;font-size:12px;margin-right:10px;">\\ \${game.i18n.localize('LANCER.Settings.useGlobalSpeed')}</label>
                        </div>
                        <div class="lcm-input-group" id="quick-typing-speed-row" style="margin-top:5px;opacity:0.5;pointer-events:none;">
                            <input type="range" id="quick-typing-speed-input" min="50" max="180" step="10" value="${typingSpeedArg !== 'null' ? typingSpeedArg : globalTypingSpeed}">
                            <span id="quick-typing-speed-display">${typingSpeedArg !== 'null' ? typingSpeedArg : globalTypingSpeed}</span>
                        </div>
                    </div>
                    <div class="lcm-form-group">
                        <label>\\ \${game.i18n.localize('LANCER.Settings.FontSize')}</label>
                        <div class="lcm-input-group">
                            <input type="range" id="quick-font-size-input" min="10" max="32" step="1" value="\\ \${defaultFontSize}">
                            <span id="quick-font-size-display">\\ \${defaultFontSize}px</span>
                        </div>
                    </div>
                    <div class="lcm-form-group">
                        <label>\\ \${game.i18n.localize('LANCER.Settings.MessageWidth')}</label>
                        <div class="lcm-input-group">
                            <input type="range" id="quick-message-width-input" min="20" max="90" step="5" value="\\ \${defaultMessageWidth}">
                            <span id="quick-message-width-display">\\ \${defaultMessageWidth}%</span>
                        </div>
                    </div>
                    <div class="lcm-form-group">
                        <label>\\ \${game.i18n.localize('LANCER.Settings.MessageStyle')}</label>
                        <select id="quick-style-select">\\ \${styleOptions}</select>
                    </div>
                </form>
            \`,
            buttons: {
                send: {
                    icon: '',
                    label: game.i18n.localize('LANCER.Settings.Send'),
                    callback: (html) => {
                        const form = html[0];
                        const message = form.querySelector('#quickMessageInput').value;
                        const useGlobalSpeed = form.querySelector('#quick-use-global-speed').checked;
                        const typingSpeed = useGlobalSpeed ? null : Number(form.querySelector('#quick-typing-speed-input').value);
                        const fontSize = Number(form.querySelector('#quick-font-size-input').value);
                        const messageWidth = Number(form.querySelector('#quick-message-width-input').value);
                        const style = form.querySelector('#quick-style-select').value;
                        resolve({ message, typingSpeed, fontSize, messageWidth, style });
                    }
                },
                cancel: {
                    icon: '',
                    label: game.i18n.localize('LANCER.Settings.Cancel'),
                    callback: () => resolve(null)
                }
            },
            default: 'send',
            render: (html) => {
                const dialog = html[0];
                
                // Обработчик чекбокса глобальной скорости
                const useGlobalCheckbox = dialog.querySelector('#quick-use-global-speed');
                const typingSpeedRow = dialog.querySelector('#quick-typing-speed-row');
                const typingSpeedInput = dialog.querySelector('#quick-typing-speed-input');
                const typingSpeedDisplay = dialog.querySelector('#quick-typing-speed-display');
                
                useGlobalCheckbox.addEventListener('change', () => {
                    if (useGlobalCheckbox.checked) {
                        typingSpeedRow.style.opacity = '0.5';
                        typingSpeedRow.style.pointerEvents = 'none';
                    } else {
                        typingSpeedRow.style.opacity = '1';
                        typingSpeedRow.style.pointerEvents = 'auto';
                    }
                });
                
                typingSpeedInput.addEventListener('input', () => {
                    typingSpeedDisplay.textContent = typingSpeedInput.value;
                });
                
                // Обработчик размера шрифта
                const fontSizeInput = dialog.querySelector('#quick-font-size-input');
                const fontSizeDisplay = dialog.querySelector('#quick-font-size-display');
                fontSizeInput.addEventListener('input', () => {
                    fontSizeDisplay.textContent = fontSizeInput.value + 'px';
                });
                
                // Обработчик ширины окна сообщения
                const messageWidthInput = dialog.querySelector('#quick-message-width-input');
                const messageWidthDisplay = dialog.querySelector('#quick-message-width-display');
                messageWidthInput.addEventListener('input', () => {
                    messageWidthDisplay.textContent = messageWidthInput.value + '%';
                });
            },
            close: () => resolve(null)
        }, { classes: ['dialog', 'lancer-communicator-dialog'] }).render(true);
    });
    
    if (result && result.message && result.message.trim()) {
        const lcmApi = game.modules.get('lancer-communicator-dcw')?.api;
        if (!lcmApi?.sendCommunicatorMessage) {
            ui.notifications.error('Lancer Communicator API is unavailable. Try reloading the world.');
            return;
        }
        lcmApi.sendCommunicatorMessage(
            "${escapedCharName}",
            "${escapedPortraitPath}",
            result.message,
            "${escapedSoundPath}",
            "${escapedVoiceoverPath}",
            "${escapedImagePath}",
            result.style,
            result.fontSize,
            "${fontFamily || ''}",
            result.typingSpeed,
            result.messageWidth,
            null,
            ${postImageToChatArg},
            ${systemAIVoiceArg}
        );
    }
})();`;

                        Macro.create({
                            name: macroName,
                            type: 'script',
                            command: commandText,
                            img: portraitPath
                        }).then(() => {
                            ui.notifications.info(game.i18n.format('LANCER.Settings.Notifications.QuickMacroCreated', { name: macroName }));
                        }).catch(error => {
                            ui.notifications.error(game.i18n.format('LANCER.Settings.Notifications.MacroError', { error }));
                            console.error('Lancer Communicator | Quick macro creation error:', error);
                        });
                    }
                },
                cancel: {
                    icon: '',
                    label: game.i18n.localize('LANCER.Settings.Cancel')
                }
            },
            default: 'create'
        }, { classes: ['dialog', 'lancer-communicator-dialog'] }).render(true);
    }

    // ─── UTILITIES ─────────────────────────────────────────────────

    /**
     * Проверяет существование файла по URL
     * @param {string} path - URL файла
     * @returns {Promise<boolean>}
     */
    static async _validateFile(path) {
        const normalizedPath = this._normalizeAssetPath(path);
        if (!normalizedPath) return false;

        try {
            const headResponse = await fetch(normalizedPath, { method: 'HEAD' });
            if (headResponse.ok) return true;

            // Some hosts/proxies reject HEAD for static assets; fallback to GET.
            const getResponse = await fetch(normalizedPath, { method: 'GET' });
            return getResponse.ok;
        } catch (error) {
            console.error(`Lancer Communicator | File validation failed for ${normalizedPath}:`, error);
            return false;
        }
    }
    /**
     * Открывает диалог просмотра и экспорта сохранённых сообщений
     */
    static openSaveMessagesDialog() {
        const isGM = game.user.isGM;
        const allowAccess = isGM || (game.settings.get('lancer-communicator-dcw', 'allowPlayersAccess') ?? true);

        if (!allowAccess) {
            ui.notifications.warn(game.i18n.localize('LANCER.Settings.Warnings.NoAccessPermission') || "Você não tem permissão para acessar os registros.");
            return;
        }

        const allowExport = isGM || (game.settings.get('lancer-communicator-dcw', 'allowPlayersExport') ?? false);
        const messages = this.savedMessages;
        const count = messages.length;

        // Build chat bubble messages
        const bubbles = count === 0
            ? `<div class="lcm-chat-empty">
                   <i class="fas fa-satellite-dish lcm-chat-empty-icon"></i>
                   <span>${game.i18n.localize('LANCER.Settings.ChatLog.Empty')}</span>
               </div>`
            : messages.map((m) => {
                const ts = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
                const style = m.style || 'undertale';
                const name = this._escapeHtml(m.characterName || '?');
                const text = this._escapeHtml(m.message || '');
                const initial = (m.characterName || '?').charAt(0).toUpperCase();
                const portrait = m.portraitPath
                    ? `<img src="${this._escapeHtml(m.portraitPath)}" alt="${name}" class="lcm-bubble-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
                    : '';
                const isSelf = m.senderId === game.user.id;
                const selfClass = isSelf ? ' lcm-bubble-row--self' : '';
                const imageContent = m.imagePath 
                    ? `<div style="margin-top:${text ? '8px' : '0'};"><img src="${this._escapeHtml(m.imagePath)}" onclick="new ImagePopout(this.getAttribute('src')).render(true);" style="max-width:100%; max-height:300px; object-fit:contain; border-radius:4px; cursor:pointer;" alt="Attached Image"></div>` 
                    : '';
                return `
                <div class="lcm-bubble-row${selfClass}">
                    <div class="lcm-bubble-avatar-wrap">
                        ${portrait}
                        <div class="lcm-bubble-initial lcm-bubble-initial--${style}"${portrait ? ' style="display:none"' : ''}>${initial}</div>
                    </div>
                    <div class="lcm-bubble-body">
                        <div class="lcm-bubble-header">
                            <span class="lcm-bubble-name lcm-bubble-name--${style}">${name}</span>
                            <span class="lcm-bubble-ts">${ts}</span>
                        </div>
                        <div class="lcm-bubble lcm-bubble--${style}">
                            ${text ? `<div>${text}</div>` : ''}
                            ${imageContent}
                        </div>
                    </div>
                </div>`;
            }).join('');

        const header = `
            <div class="lcm-chat-header">
                <i class="fas fa-satellite-dish"></i>
                <span>${game.i18n.localize('LANCER.Settings.ChatLog.Title')}</span>
                <span class="lcm-chat-header-count">${count}</span>
            </div>`;

        const content = `
            <div class="lancer-communicator-dialog lcm-save-dialog">
                ${header}
                <div class="lcm-chat-feed" id="lcm-chat-feed">
                    ${bubbles}
                </div>
            </div>`;

        const buttons = {};

        if (allowExport) {
            buttons.exportJson = {
                icon: '<i class="fas fa-file-code"></i>',
                label: game.i18n.localize('LANCER.Settings.ChatLog.ExportJSON'),
                callback: () => this._downloadMessages('json')
            };
            buttons.exportTxt = {
                icon: '<i class="fas fa-file-alt"></i>',
                label: game.i18n.localize('LANCER.Settings.ChatLog.ExportTXT'),
                callback: () => this._downloadMessages('txt')
            };
        }

        if (isGM) {
            buttons.clear = {
                icon: '<i class="fas fa-trash"></i>',
                label: game.i18n.localize('LANCER.Settings.ChatLog.Clear'),
                callback: () => {
                    this.savedMessages = [];
                    ui.notifications.info(game.i18n.localize('LANCER.Settings.ChatLog.Cleared'));
                }
            };
        }

        buttons.close = {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize('LANCER.Settings.Cancel')
        };

        const dlg = new Dialog({
            title: game.i18n.localize('LANCER.Settings.ChatLog.Title'),
            content,
            buttons,
            default: 'close',
            render: (html) => {
                // Scroll to bottom on open
                const feed = html[0].querySelector('#lcm-chat-feed');
                if (feed) feed.scrollTop = feed.scrollHeight;
            }
        }, {
            width: 800,
            height: 600,
            classes: ['dialog', 'lcm-custom-dialog']
        }).render(true);
    }

    /**
    /**
     * Скачивает сохранённые сообщения как файл
     * @param {'json'|'txt'} format - Формат файла
     */
    static _downloadMessages(format) {
        const messages = this.savedMessages;

        // Verificação de segurança extra
        if (!messages || messages.length === 0) {
            ui.notifications.warn(game.i18n.localize('LANCER.Settings.ChatLog.Empty'));
            return;
        }

        let content, mime, ext;

        if (format === 'json') {
            content = JSON.stringify(messages, null, 2);
            mime = 'application/json';
            ext = 'json';
        } else {
            // Formato TXT com limpeza de HTML e melhor espaçamento
            content = messages.map(m => {
                const ts = m.timestamp ? new Date(m.timestamp).toLocaleString() : '--';
                const charName = m.characterName || game.i18n.localize('LANCER.Unknown') || 'Unknown';

                // Remove tags HTML se a mensagem for texto rico (opcional, mas recomendado para TXT)
                const cleanMessage = m.message ? m.message.replace(/<[^>]+>/g, '') : '';
                const imageNote = m.imagePath ? ` [Image Attached: ${m.imagePath}]` : '';

                return `[${ts}] ${charName}: ${cleanMessage}${imageNote}`;
            }).join('\n\n'); // Dupla quebra de linha para separar melhor cada mensagem

            mime = 'text/plain';
            ext = 'txt';
        }

        const date = new Date().toISOString().slice(0, 10);
        const filename = `communicator-log-${date}.${ext}`;

        // Utiliza o helper nativo do Foundry VTT se disponível (muito mais limpo)
        if (typeof saveDataToFile === 'function') {
            saveDataToFile(content, mime, filename);
        } else {
            // Fallback clássico caso a função nativa falhe/não exista
            const blob = new Blob([content], { type: mime });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
}
