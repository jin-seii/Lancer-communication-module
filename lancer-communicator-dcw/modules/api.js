import { LancerCommunicator } from './communicator.js';

const MODULE_ID = 'lancer-communicator-dcw';

/**
 * Registers the module public API for access from macros
 */
export function registerAPI() {
    const moduleRef = game.modules.get(MODULE_ID);
    if (!moduleRef) {
        console.error(`Lancer Communicator | Failed to register API: module '${MODULE_ID}' not found`);
        return false;
    }

    moduleRef.api = {
        /**
         * Opens the communicator settings dialog
         */
        openCommunicatorSettings: LancerCommunicator.openCommunicatorSettings.bind(LancerCommunicator),

        /**
         * Sends a communicator message to all connected clients
         * @param {string} characterName - Character name
         * @param {string} portraitPath - Path to the portrait image
         * @param {string} message - Message text
         * @param {string} soundPath - Path to sound file (optional)
         * @param {string} voiceoverPath - Path to voiceover file (optional)
         * @param {string} style - Message style (green, blue, yellow, red, damaged, undertale)
         * @param {number} fontSize - Font size in pixels
         * @param {string|null} fontFamily - Font family
         * @param {number|null} typingSpeed - Typing speed (null = use global)
         * @param {number|null} messageWidth - Message window width in percent (20-90, null = global)
         * @param {boolean} systemAIVoice - Use a random voice from template/sysai
         */
        sendCommunicatorMessage: LancerCommunicator.sendCommunicatorMessage.bind(LancerCommunicator),

        /**
         * Calculates typing speed based on audio duration and text length
         * @param {number} audioDuration - Audio duration in seconds
         * @param {number} textLength - Text length in characters
         * @returns {number} - Recommended typing speed (50-180)
         */
        calculateTypingSpeedFromAudio: LancerCommunicator._calculateTypingSpeedFromAudio.bind(LancerCommunicator),

        /**
         * Gets audio file duration
         * @param {string} audioPath - Path to audio file
         * @returns {Promise<number>} - Duration in seconds
         */
        getAudioDuration: LancerCommunicator._getAudioDuration.bind(LancerCommunicator),

        /**
         * Outputs a debug message to the console when debug mode is enabled
         * @param {string} message - Message to output
         * @param {...any} args - Additional arguments
         */
        debug: LancerCommunicator.debug.bind(LancerCommunicator)
    };

    return true;
}
