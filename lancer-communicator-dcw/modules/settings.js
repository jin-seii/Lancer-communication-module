/**
 * Lancer Communicator settings registration module
 */
export function registerSettings() {
    const MODULE = 'lancer-communicator-dcw';

    // ─── User Settings ────────────────────────────────────────────

    game.settings.register(MODULE, 'postToChat', {
        name: game.i18n.localize('LANCER.Settings.PostToChat'),
        hint: game.i18n.localize('LANCER.Settings.PostToChatHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE, 'postImageToChat', {
        name: game.i18n.localize('LANCER.Settings.PostImageToChat'),
        hint: game.i18n.localize('LANCER.Settings.PostImageToChatHint'),
        scope: 'client',
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE, 'allowPlayersAccess', {
        name: game.i18n.localize('LANCER.Settings.AllowPlayersAccess'),
        hint: game.i18n.localize('LANCER.Settings.AllowPlayersAccessHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE, 'allowPlayersExport', {
        name: game.i18n.localize('LANCER.Settings.AllowPlayersExport'),
        hint: game.i18n.localize('LANCER.Settings.AllowPlayersExportHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register(MODULE, 'globalTypingSpeed', {
        name: game.i18n.localize('LANCER.Settings.globalTypingSpeed'),
        hint: game.i18n.localize('LANCER.Settings.globalTypingSpeedHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: { min: 50, max: 180, step: 10 },
        default: 130
    });

    game.settings.register(MODULE, 'sentencePauseDelay', {
        name: game.i18n.localize('LANCER.Settings.sentencePauseDelay'),
        hint: game.i18n.localize('LANCER.Settings.sentencePauseDelayHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: { min: 0, max: 1000, step: 50 },
        default: 300
    });

    game.settings.register(MODULE, 'voiceVolume', {
        name: game.i18n.localize('LANCER.Settings.voiceVolume'),
        hint: game.i18n.localize('LANCER.Settings.voiceVolumeHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: { min: 0.1, max: 1.0, step: 0.05 },
        default: 0.3
    });

    game.settings.register(MODULE, 'messageFontSize', {
        name: game.i18n.localize('LANCER.Settings.FontSize'),
        hint: game.i18n.localize('LANCER.Settings.FontSizeHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: { min: 10, max: 32, step: 1 },
        default: 18,
        onChange: (value) => {
            document.documentElement.style.setProperty('--message-font-size', `${value}px`);
        }
    });

    game.settings.register(MODULE, 'globalMessageWidth', {
        name: game.i18n.localize('LANCER.Settings.globalMessageWidth'),
        hint: game.i18n.localize('LANCER.Settings.globalMessageWidthHint'),
        scope: 'world',
        config: true,
        type: Number,
        range: { min: 20, max: 90, step: 5 },
        default: 30,
        onChange: (value) => {
            document.documentElement.style.setProperty('--message-width', `${value}%`);
            document.documentElement.style.setProperty('--message-left', `${(100 - value) / 2}%`);
        }
    });

    game.settings.register(MODULE, 'debugMode', {
        name: game.i18n.localize('LANCER.Settings.debugMode'),
        hint: game.i18n.localize('LANCER.Settings.debugModeHint'),
        scope: 'world',
        config: true,
        type: Boolean,
        default: false
    });

    // ─── Font Settings ────────────────────────────────────────────

    game.settings.register(MODULE, 'fontFamily', {
        name: game.i18n.localize('LANCER.Settings.FontFamily'),
        hint: game.i18n.localize('LANCER.Settings.FontFamilyHint'),
        scope: 'client',
        config: false,
        type: String,
        default: 'Purista'
    });

    game.settings.register(MODULE, 'communicatorFont', {
        name: game.i18n.localize('LANCER.Settings.FontSelect'),
        scope: 'world',
        config: false,
        type: String,
        choices: {
            'MOSCOW2024': 'MOSCOW2024',
            'Purista': 'Purista',
            'Purista Bold': 'Purista Bold',
            'Orbitron': 'Orbitron',
            'Share Tech Mono': 'Share Tech Mono',
            'Chakra Petch': 'Chakra Petch',
            'Space Mono': 'Space Mono',
            'Handjet': 'Handjet',
            'Undertale': 'Undertale',
            'TeletactileRus': 'TeletactileRus',
            'Kereru': 'Kereru',
            'Serif': 'Serif',
            'Sans-serif': 'Sans-serif'
        },
        default: 'Purista',
        onChange: (value) => {
            document.documentElement.style.setProperty('--message-font', value);
        }
    });

    // ─── Client Saved Values ──────────────────────────────────────

    game.settings.register(MODULE, 'lastPortrait', {
        name: game.i18n.localize('LANCER.Settings.currentPortrait'),
        scope: 'client',
        config: false,
        type: String,
        default: ''
    });

    game.settings.register(MODULE, 'lastSound', {
        name: game.i18n.localize('LANCER.Settings.currentSound'),
        scope: 'client',
        config: false,
        type: String,
        default: ''
    });

    game.settings.register(MODULE, 'lastCharacterName', {
        name: game.i18n.localize('LANCER.Settings.lastCharacterName'),
        scope: 'client',
        config: false,
        type: String,
        default: ''
    });

    game.settings.register(MODULE, 'lastMessageStyle', {
        name: game.i18n.localize('LANCER.Settings.lastMessageStyle'),
        scope: 'client',
        config: false,
        type: String,
        default: 'undertale'
    });

    game.settings.register(MODULE, 'lastVoiceover', {
        name: game.i18n.localize('LANCER.Settings.lastVoiceover'),
        scope: 'client',
        config: false,
        type: String,
        default: ''
    });

    game.settings.register(MODULE, 'lastTypingSpeed', {
        name: 'Last Typing Speed',
        scope: 'client',
        config: false,
        type: Number,
        default: null
    });

    game.settings.register(MODULE, 'lastMessageWidth', {
        name: 'Last Message Box Width',
        scope: 'client',
        config: false,
        type: Number,
        default: null
    });

    game.settings.register(MODULE, 'lastImage', {
        name: game.i18n.localize('LANCER.Settings.ImageSelect'),
        scope: 'client',
        config: false,
        type: String,
        default: ''
    });

    game.settings.register(MODULE, 'lastSystemAIVoice', {
        name: game.i18n.localize('LANCER.Settings.SystemAIVoice'),
        scope: 'client',
        config: false,
        type: Boolean,
        default: false
    });
}
