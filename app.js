// Initialize audio context
let audioContext = null;
let oscillator = null;
let gainNode = null;
let filterNode = null;

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
const toneFrequencyInput = document.getElementById('toneFrequency');
const frequencyValueSpan = document.getElementById('frequencyValue');
const toneVolumeInput = document.getElementById('toneVolume');
const volumeValueSpan = document.getElementById('volumeValue');

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
toneFrequencyInput.addEventListener('input', updateFrequencyDisplay);
toneFrequencyInput.addEventListener('change', saveSettings);
toneVolumeInput.addEventListener('input', updateVolumeDisplay);
toneVolumeInput.addEventListener('change', saveSettings);

function updateFrequencyDisplay() {
    frequencyValueSpan.textContent = toneFrequencyInput.value;
}

function updateVolumeDisplay() {
    volumeValueSpan.textContent = toneVolumeInput.value;
}

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
    
    // Update button states
    playBtn.disabled = true;
    stopBtn.disabled = false;
    
    playRandomCharacter();
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
    if (filterNode) {
        filterNode.disconnect();
        filterNode = null;
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
    const toneFrequency = parseFloat(toneFrequencyInput.value);
    const filterCutoffFrequency = toneFrequency + 200; // Set filter cutoff 200Hz above the tone frequency
    const toneVolumeDb = parseFloat(toneVolumeInput.value);
    const toneVolume = Math.pow(10, toneVolumeDb / 20); // Convert dB to linear scale

    oscillator = audioContext.createOscillator();
    gainNode = audioContext.createGain();
    filterNode = audioContext.createBiquadFilter();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(toneFrequency, audioContext.currentTime);

    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(filterCutoffFrequency, audioContext.currentTime);
    filterNode.Q.setValueAtTime(1, audioContext.currentTime);

    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(toneVolume, audioContext.currentTime + fadeTime);
    gainNode.gain.setValueAtTime(toneVolume, audioContext.currentTime + duration - fadeTime);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);

    oscillator.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);

    oscillator.onended = () => {
        oscillator.disconnect();
        filterNode.disconnect();
        gainNode.disconnect();
        onComplete();
    };
}

function getDitDuration() {
    return 1.2 / parseInt(wpmInput.value);
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
    localStorage.setItem('cwTrainerToneFrequency', toneFrequencyInput.value);
    localStorage.setItem('cwTrainerToneVolume', toneVolumeInput.value);
    updateFrequencyDisplay();
    updateVolumeDisplay();
}

function loadSettings() {
    const savedWPM = localStorage.getItem('cwTrainerWPM');
    const savedRepetitions = localStorage.getItem('cwTrainerRepetitions');
    const savedLanguage = localStorage.getItem('cwTrainerLanguage');
    const savedToneFrequency = localStorage.getItem('cwTrainerToneFrequency');
    const savedToneVolume = localStorage.getItem('cwTrainerToneVolume');
    
    if (savedWPM) wpmInput.value = savedWPM;
    if (savedRepetitions) repetitionsInput.value = savedRepetitions;
    if (savedLanguage && Object.keys(supportedLanguages).includes(savedLanguage)) {
        languageSelect.value = savedLanguage;
    } else {
        languageSelect.value = 'en-US'; // Default to English
    }
    if (savedToneFrequency) {
        toneFrequencyInput.value = savedToneFrequency;
    } else {
        toneFrequencyInput.value = "700"; // Default to 700 Hz if not set
    }
    if (savedToneVolume) {
        toneVolumeInput.value = savedToneVolume;
    } else {
        toneVolumeInput.value = "0"; // Default to 0 dB if not set
    }
    
    updateFrequencyDisplay();
    updateVolumeDisplay();
    updateLanguage();
}

// Initialize voices when they are loaded
speechSynthesis.onvoiceschanged = updateLanguage;

// Initial button state
stopBtn.disabled = true;

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('Service Worker registered successfully:', registration.scope);
            })
            .catch(error => {
                console.log('Service Worker registration failed:', error);
            });
    });
}
