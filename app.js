// Initialize audio context
let audioContext = null;
let oscillator = null;
let gainNode = null;

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

// Audio parameters
let isPlaying = false;
let currentTimeout = null;

// Load saved settings
loadSettings();

// Event listeners
playBtn.addEventListener('click', startPlaying);
stopBtn.addEventListener('click', stopPlaying);
wpmInput.addEventListener('change', saveSettings);
repetitionsInput.addEventListener('change', saveSettings);

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
}

function playRandomCharacter() {
    if (!isPlaying) return;
    
    const characters = Object.keys(morseCode);
    const randomChar = characters[Math.floor(Math.random() * characters.length)];
    const morseSequence = morseCode[randomChar];
    
    playMorseSequence(morseSequence, () => {
        const repetitions = parseInt(repetitionsInput.value);
        let count = 1;
        
        function repeat() {
            if (count < repetitions && isPlaying) {
                playMorseSequence(morseSequence, () => {
                    count++;
                    currentTimeout = setTimeout(repeat, getCharacterSpace());
                });
            } else if (isPlaying) {
                currentTimeout = setTimeout(playRandomCharacter, getWordSpace());
            }
        }
        
        currentTimeout = setTimeout(repeat, getCharacterSpace());
    });
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
    gainNode.gain.linearRampToValueAtTime(1, currentTime + 0.001);
    gainNode.gain.setValueAtTime(1, currentTime + duration - 0.001);
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
}

function loadSettings() {
    const savedWPM = localStorage.getItem('cwTrainerWPM');
    const savedRepetitions = localStorage.getItem('cwTrainerRepetitions');
    
    if (savedWPM) wpmInput.value = savedWPM;
    if (savedRepetitions) repetitionsInput.value = savedRepetitions;
}