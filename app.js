// Initialize audio context
let audioContext = null;
let oscillator = null;
let gainNode = null;

let morseGain = 0.1;
let fadeTime = 0.001;

// Initialize speech synthesis
let speechSynthesis = window.speechSynthesis;
let speechUtterance = new SpeechSynthesisUtterance();

// Morse code dictionary
const morseCode = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
    'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
    'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
    'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
    'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
    '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.', '.': '.-.-.-', ',': '--..--', '?': '..--..'
};

// DOM elements
const playBtn = document.getElementById('playBtn');
const stopBtn = document.getElementById('stopBtn');
const wpmInput = document.getElementById('wpm');
const repetitionsInput = document.getElementById('repetitions');
const languageSelect = document.getElementById('languageSelect');

// Audio parameters
let isPlaying = false;
let currentTimeout = null;

// Supported languages
const supportedLanguages = {
    'en-US': 'English',
    'fr-FR': 'Français'
};

// Load saved settings
loadSettings();

// Event listeners
playBtn.addEventListener('click', startPlaying);
stopBtn.addEventListener('click', stopPlaying);
wpmInput.addEventListener('change', saveSettings);
repetitionsInput.addEventListener('change', saveSettings);
languageSelect.addEventListener('change', updateLanguage);

function updateLanguage() {
    const selectedLang = languageSelect.value;
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang === selectedLang) || voices.find(v => v.lang.startsWith(selectedLang.split('-')[0])) || voices[0];
    speechUtterance.voice = voice;
    speechUtterance.lang = voice.lang;
    saveSettings();
}

function startPlaying() {
    if (isPlaying) return;
    isPlaying = true;
    
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Create oscillator and gain node
    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(700, audioContext.currentTime);
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start();
    
    playRandomCharacter();
    
    // Update button states
    playBtn.disabled = true;
    stopBtn.disabled = false;
}

function stopPlaying() {
    isPlaying = false;
    if (currentTimeout) {
        clearTimeout(currentTimeout);
    }
    if (oscillator) {
        oscillator.stop();
        oscillator.disconnect();
        oscillator = null;
    }
    if (gainNode) {
        gainNode.disconnect();
        gainNode = null;
    }
    speechSynthesis.cancel();
    
    // Update button states
    playBtn.disabled = false;
    stopBtn.disabled = true;
}

function playRandomCharacter() {
    if (!isPlaying) return;
    
    const characters = Object.keys(morseCode);
    const randomChar = characters[Math.floor(Math.random() * characters.length)];
    const morseSequence = morseCode[randomChar];
    
    speakCharacter(randomChar, () => {
        playMorseSequence(morseSequence, () => {
            const repetitions = parseInt(repetitionsInput.value);
            let count = 1;
            
            function repeat() {
                if (count < repetitions && isPlaying) {
                    playMorseSequence(morseSequence, () => {
                        count++;
                        if (count === repetitions) {
                            speakCharacter(randomChar, () => {
                                currentTimeout = setTimeout(playRandomCharacter, getWordSpace());
                            });
                        } else {
                            currentTimeout = setTimeout(repeat, getCharacterSpace());
                        }
                    });
                } else if (isPlaying) {
                    speakCharacter(randomChar, () => {
                        currentTimeout = setTimeout(playRandomCharacter, getWordSpace());
                    });
                }
            }
            
            currentTimeout = setTimeout(repeat, getCharacterSpace());
        });
    });
}

function speakCharacter(character, onComplete) {
    speechUtterance.text = character;
    speechUtterance.rate = 1.5;  // Adjust rate as needed
    speechUtterance.onend = onComplete;
    speechSynthesis.speak(speechUtterance);
}

function playMorseSequence(sequence, onComplete) {
    let index = 0;
    
    function playNextSymbol() {
        if (index < sequence.length && isPlaying) {
            const symbol = sequence[index];
            const duration = symbol === '.' ? getDitDuration() : getDahDuration();
            
            playTone(duration, () => {
                index++;
                currentTimeout = setTimeout(playNextSymbol, getSymbolSpace());
            });
        } else if (onComplete) {
            onComplete();
        }
    }
    
    playNextSymbol();
}

function playTone(duration, onComplete) {
    const currentTime = audioContext.currentTime;
    
    gainNode.gain.setValueAtTime(0, currentTime);
    gainNode.gain.linearRampToValueAtTime(morseGain, currentTime + fadeTime);
    gainNode.gain.setValueAtTime(morseGain, currentTime + duration - fadeTime);
    gainNode.gain.linearRampToValueAtTime(0, currentTime + duration);
    
    setTimeout(onComplete, duration * 1000);
}

function getDitDuration() {
    return 60 / (50 * parseInt(wpmInput.value));
}

function getDahDuration() {
    return getDitDuration() * 3;
}

function getSymbolSpace() {
    return getDitDuration() * 1000;
}

function getCharacterSpace() {
    return getDitDuration() * 3 * 1000;
}

function getWordSpace() {
    return getDitDuration() * 7 * 1000;
}

function saveSettings() {
    localStorage.setItem('cwTrainerWPM', wpmInput.value);
    localStorage.setItem('cwTrainerRepetitions', repetitionsInput.value);
    localStorage.setItem('cwTrainerLanguage', languageSelect.value);
}

function loadSettings() {
    const savedWPM = localStorage.getItem('cwTrainerWPM');
    const savedRepetitions = localStorage.getItem('cwTrainerRepetitions');
    const savedLanguage = localStorage.getItem('cwTrainerLanguage');
    
    if (savedWPM) wpmInput.value = savedWPM;
    if (savedRepetitions) repetitionsInput.value = savedRepetitions;
    if (savedLanguage && Object.keys(supportedLanguages).includes(savedLanguage)) {
        languageSelect.value = savedLanguage;
    } else {
        languageSelect.value = 'en-US'; // Default to English
    }
    
    updateLanguage();
}

// Initialize voices when they are loaded
speechSynthesis.onvoiceschanged = updateLanguage;

// Initial button state
stopBtn.disabled = true;
