document.addEventListener('DOMContentLoaded', async () => {
    
    // --- Elements ---
    const viewOnboarding = document.getElementById('view-onboarding');
    const viewDashboard = document.getElementById('view-dashboard');
    const btnSaveKey = document.getElementById('btn-save-key');
    const inputApiKey = document.getElementById('input-api-key');
    const btnToggleVisibility = document.getElementById('btn-toggle-visibility');
    const btnSettings = document.getElementById('btn-settings');
    const errorMsg = document.getElementById('error-msg');
    
    // Feature Controls
    const toggleContrast = document.getElementById('toggle-contrast');
    const sliderTextSize = document.getElementById('slider-text-size');
    const textSizeVal = document.getElementById('text-size-val');
    const btnDescribeImages = document.getElementById('btn-describe-images');
    const toggleReader = document.getElementById('toggle-reader');
    const toggleBionic = document.getElementById('toggle-bionic');
    const toggleDyslexia = document.getElementById('toggle-dyslexia');
    const btnSimplify = document.getElementById('btn-simplify');
    const btnTtsPlay = document.getElementById('btn-tts-play');
    const btnTtsPause = document.getElementById('btn-tts-pause');
    const btnTtsStop = document.getElementById('btn-tts-stop');

    // Loaders
    const loaderImages = document.getElementById('loader-images');
    const loaderSimplify = document.getElementById('loader-simplify');

    // --- State Initialization ---
    const data = await chrome.storage.local.get(['geminiApiKey', 'settings']);
    let apiKey = data.geminiApiKey;
    let settings = data.settings || {};

    if (apiKey) {
        showDashboard();
        restoreSettingsUI(settings);
    } else {
        showOnboarding();
    }

    // --- Onboarding Logic ---
    btnSaveKey.addEventListener('click', () => {
        const key = inputApiKey.value.trim();
        if (key.length > 10) { // Basic validation
            chrome.storage.local.set({ geminiApiKey: key }, () => {
                apiKey = key;
                showDashboard();
            });
        } else {
            errorMsg.classList.remove('hidden');
        }
    });

    btnToggleVisibility.addEventListener('click', () => {
        if (inputApiKey.type === 'password') {
            inputApiKey.type = 'text';
            btnToggleVisibility.textContent = 'Hide';
        } else {
            inputApiKey.type = 'password';
            btnToggleVisibility.textContent = 'Show';
        }
    });

    btnSettings.addEventListener('click', () => {
        chrome.storage.local.remove('geminiApiKey', () => {
            showOnboarding();
        });
    });

    function showDashboard() {
        viewOnboarding.classList.add('hidden');
        viewDashboard.classList.remove('hidden');
        btnSettings.classList.remove('hidden');
    }

    function showOnboarding() {
        viewOnboarding.classList.remove('hidden');
        viewDashboard.classList.add('hidden');
        btnSettings.classList.add('hidden');
        inputApiKey.value = '';
    }

    function restoreSettingsUI(s) {
        if (s.contrast) toggleContrast.checked = true;
        if (s.textSize) {
            sliderTextSize.value = s.textSize;
            textSizeVal.innerText = s.textSize + '%';
        }
        if (s.reader) toggleReader.checked = true;
        if (s.bionic) toggleBionic.checked = true;
        if (s.dyslexia) toggleDyslexia.checked = true;
    }

    // --- Feature Interactions ---
    
    // Helper to send message to active tab content script
    function sendMessageToContent(action, payload = {}) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, { action, ...payload }, (response) => {
                    // Ignore errors if the content script hasn't loaded yet or on restricted pages
                    if (chrome.runtime.lastError) {
                        console.log("AccessMate: Could not send message. Tab might be reloading or restricted.", chrome.runtime.lastError.message);
                    }
                });
            }
        });
    }

    function saveSetting(key, value) {
        chrome.storage.local.get(['settings'], (result) => {
            const current = result.settings || {};
            current[key] = value;
            chrome.storage.local.set({ settings: current });
        });
    }

    // 1. Smart Contrast
    toggleContrast.addEventListener('change', (e) => {
        saveSetting('contrast', e.target.checked);
        sendMessageToContent('TOGGLE_CONTRAST', { enable: e.target.checked });
    });

    // 2. Text Resizer
    sliderTextSize.addEventListener('input', (e) => {
        const val = e.target.value;
        textSizeVal.innerText = val + '%';
        saveSetting('textSize', val);
        sendMessageToContent('SET_TEXT_SIZE', { size: val });
    });

    // 3. AI Describe Images
    btnDescribeImages.addEventListener('click', async () => {
        if (!apiKey) return alert('No API Key found');
        
        loaderImages.classList.remove('hidden');
        btnDescribeImages.disabled = true;

        sendMessageToContent('DESCRIBE_IMAGES');
        
        setTimeout(() => {
            loaderImages.classList.add('hidden');
            btnDescribeImages.disabled = false;
        }, 3000); 
    });

    // 4. Reader Mode
    toggleReader.addEventListener('change', (e) => {
        saveSetting('reader', e.target.checked);
        sendMessageToContent('TOGGLE_READER_MODE', { enable: e.target.checked });
    });

    // 5. Bionic Reading
    toggleBionic.addEventListener('change', (e) => {
        saveSetting('bionic', e.target.checked);
        sendMessageToContent('TOGGLE_BIONIC', { enable: e.target.checked });
    });

    // 6. Dyslexia Font
    toggleDyslexia.addEventListener('change', (e) => {
        saveSetting('dyslexia', e.target.checked);
        sendMessageToContent('TOGGLE_DYSLEXIA', { enable: e.target.checked });
    });

    // 7. AI Simplify
    btnSimplify.addEventListener('click', () => {
        if (!apiKey) return alert('No API Key found');
        loaderSimplify.classList.remove('hidden');
        btnSimplify.disabled = true;

        sendMessageToContent('SIMPLIFY_TEXT_REQUEST');

        setTimeout(() => {
            loaderSimplify.classList.add('hidden');
            btnSimplify.disabled = false;
        }, 5000);
    });

    // 8. TTS Controls
    btnTtsPlay.addEventListener('click', () => sendMessageToContent('TTS_PLAY'));
    btnTtsPause.addEventListener('click', () => sendMessageToContent('TTS_PAUSE'));
    btnTtsStop.addEventListener('click', () => sendMessageToContent('TTS_STOP'));

});