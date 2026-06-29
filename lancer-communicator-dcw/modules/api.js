import { LancerCommunicator } from './communicator.js';

const MODULE_ID = 'lancer-communicator-dcw';

/**
 * Регистрирует публичное API модуля для доступа из макросов
 */
export function registerAPI() {
    const moduleRef = game.modules.get(MODULE_ID);
    if (!moduleRef) {
        console.error(`Lancer Communicator | Failed to register API: module '${MODULE_ID}' not found`);
        return false;
    }

    moduleRef.api = {
        /**
         * Открывает диалог настроек коммуникатора
         */
        openCommunicatorSettings: LancerCommunicator.openCommunicatorSettings.bind(LancerCommunicator),

        /**
         * Отправляет сообщение коммуникатора всем подключённым клиентам
         * @param {string} characterName - Имя персонажа
         * @param {string} portraitPath - Путь к изображению портрета
         * @param {string} message - Текст сообщения
         * @param {string} soundPath - Путь к звуковому файлу (опционально)
         * @param {string} voiceoverPath - Путь к файлу озвучки (опционально)
         * @param {string} style - Стиль сообщения (green, blue, yellow, red, damaged, undertale)
         * @param {number} fontSize - Размер шрифта в пикселях
         * @param {string|null} fontFamily - Семейство шрифта
         * @param {number|null} typingSpeed - Скорость печати (null = использовать глобальную)
         * @param {number|null} messageWidth - Ширина окна сообщения в процентах (20-90, null = глобальная)
         */
        sendCommunicatorMessage: LancerCommunicator.sendCommunicatorMessage.bind(LancerCommunicator),

        /**
         * Вычисляет скорость печати на основе длительности аудио и длины текста
         * @param {number} audioDuration - Длительность аудио в секундах
         * @param {number} textLength - Длина текста в символах
         * @returns {number} - Рекомендуемая скорость печати (50-180)
         */
        calculateTypingSpeedFromAudio: LancerCommunicator._calculateTypingSpeedFromAudio.bind(LancerCommunicator),

        /**
         * Получает длительность аудиофайла
         * @param {string} audioPath - Путь к аудиофайлу
         * @returns {Promise<number>} - Длительность в секундах
         */
        getAudioDuration: LancerCommunicator._getAudioDuration.bind(LancerCommunicator),

        /**
         * Выводит отладочное сообщение в консоль, если включен режим дебага
         * @param {string} message - Сообщение для вывода
         * @param {...any} args - Дополнительные аргументы
         */
        debug: LancerCommunicator.debug.bind(LancerCommunicator)
    };

    return true;
}
