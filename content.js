// --- State ---
console.log("AccessMate: Content Script Loaded");

let isBionicActive = false;
let ttsUtterance = null;

// --- Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log("AccessMate: Received message", message);
  switch (message.action) {
    case 'TOGGLE_CONTRAST':
      toggleContrast(message.enable);
      break;
    case 'SET_TEXT_SIZE':
      setTextSize(message.size);
      break;
    case 'DESCRIBE_IMAGES':
      processImages();
      break;
    case 'TOGGLE_READER_MODE':
      toggleReaderMode(message.enable);
      break;
    case 'TOGGLE_BIONIC':
      toggleBionicReading(message.enable);
      break;
    case 'TOGGLE_DYSLEXIA':
      toggleDyslexiaFont(message.enable);
      break;
    case 'SIMPLIFY_TEXT_REQUEST':
      simplifyText();
      break;
    case 'TTS_PLAY':
      ttsPlay();
      break;
    case 'TTS_PAUSE':
      ttsPause();
      break;
    case 'TTS_STOP':
      ttsStop();
      break;
  }
});

// --- Feature 1: Visual ---

function toggleContrast(enable) {
  if (enable) {
    // High contrast filter
    document.documentElement.style.filter = 'contrast(150%) grayscale(100%)';
  } else {
    document.documentElement.style.filter = '';
  }
}

function setTextSize(percent) {
  const scale = parseInt(percent, 10) / 100;
  
  if (isNaN(scale)) return;

  // Use TreeWalker to find all text nodes efficiently
  const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
          acceptNode: function(node) {
              // Skip empty text or whitespace only
              if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
              
              const parent = node.parentElement;
              if (!parent) return NodeFilter.FILTER_REJECT;

              // Skip extension UI elements
              if (parent.closest('#accessmate-toast') || 
                  parent.closest('#accessmate-reader-view')) {
                  return NodeFilter.FILTER_REJECT;
              }

              // Skip non-visible or structural tags
              const tag = parent.tagName.toLowerCase();
              if (['script', 'style', 'noscript', 'img', 'svg', 'iframe'].includes(tag)) {
                  return NodeFilter.FILTER_REJECT;
              }
              
              return NodeFilter.FILTER_ACCEPT;
          }
      }
  );

  const elementsToResize = new Set();
  
  while(walker.nextNode()) {
      elementsToResize.add(walker.currentNode.parentElement);
  }

  elementsToResize.forEach(el => {
      // Store the original computed font size on the first run
      if (!el.dataset.accessmateOriginalSize) {
          const computed = window.getComputedStyle(el).fontSize;
          // Ensure we get a valid pixel value
          if (computed && computed.endsWith('px')) {
              el.dataset.accessmateOriginalSize = parseFloat(computed);
          } else {
              // Fallback if something weird happens, though getComputedStyle usually returns px
              return; 
          }
      }
      
      const original = parseFloat(el.dataset.accessmateOriginalSize);
      if (original) {
          // Apply new size
          el.style.fontSize = `${original * scale}px`;
          
          // Optional: Improve line-height for readability at larger sizes
          // We only set it if we haven't already to avoid overriding custom line-heights too aggressively
          if (!el.dataset.accessmateOriginalLineHeight) {
             el.dataset.accessmateOriginalLineHeight = window.getComputedStyle(el).lineHeight;
          }
          // el.style.lineHeight = '1.5'; // Keeping this commented out to reduce layout shift risk
      }
  });
}

// --- Feature 2: Image Description (AI) ---

async function processImages() {
  const images = Array.from(document.querySelectorAll('img:not([alt]), img[alt=""]'));
  // Limit to first 5 for demo/cost performance
  const batch = images.slice(0, 5);
  
  if (batch.length === 0) {
      showToast("No suitable images found to analyze.");
      return;
  }

  showToast(`Analyzing ${batch.length} images...`);

  let count = 0;
  for (const img of batch) {
    // Skip tiny icons or hidden images
    if (img.width < 50 || img.height < 50) continue;

    // Send to background to process
    const src = img.src;
    
    chrome.runtime.sendMessage({
      action: 'GEMINI_ANALYZE_IMAGE',
      imageUrl: src
    }, (response) => {
      if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
      }
      if (response && response.description) {
        img.alt = "[AI] " + response.description;
        img.title = response.description; // Tooltip
        img.style.border = "2px solid #2563eb"; // Visual indicator
        count++;
      }
    });
  }
}

// --- Feature 3: Cognitive ---

function toggleReaderMode(enable) {
  const overlayId = 'accessmate-reader-view';
  let overlay = document.getElementById(overlayId);

  if (enable) {
    if (overlay) return; // Already active

    const contentEl = findMainContent();
    if (!contentEl) {
      showToast("Could not find suitable content for Reader Mode.");
      return;
    }

    // 1. Create Overlay Container (Full Screen)
    overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', 'Reader View');
    
    // Style: Warm paper background, high readability
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#f8f1e3', // Warm sepia
      color: '#2d3436',
      zIndex: '2147483646', // Below toast/modal but above everything else
      overflowY: 'auto',
      boxSizing: 'border-box',
      display: 'block'
    });

    // 2. Create Inner Content Wrapper (Centered column)
    const container = document.createElement('div');
    Object.assign(container.style, {
      maxWidth: '740px',
      margin: '0 auto',
      padding: '60px 20px',
      backgroundColor: '#ffffff',
      boxShadow: '0 0 40px rgba(0,0,0,0.05)',
      minHeight: '100vh',
      fontFamily: '"Merriweather", "Georgia", serif',
      fontSize: '20px',
      lineHeight: '1.8'
    });

    // 3. Close Button
    const closeBtn = document.createElement('button');
    closeBtn.innerText = "Exit Reader Mode";
    Object.assign(closeBtn.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '10px 20px',
      backgroundColor: '#333',
      color: '#fff',
      border: 'none',
      borderRadius: '20px',
      cursor: 'pointer',
      zIndex: '2147483647',
      fontFamily: 'sans-serif',
      fontSize: '14px',
      fontWeight: 'bold',
      boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
    });
    closeBtn.onclick = () => toggleReaderMode(false);

    // 4. Clone and Sanitize Content
    const clone = contentEl.cloneNode(true);
    cleanReaderContent(clone);

    // Add Title if missing from captured content
    if (!clone.querySelector('h1')) {
      const pageTitle = document.createElement('h1');
      pageTitle.innerText = document.title;
      pageTitle.style.marginBottom = '40px';
      container.prepend(pageTitle);
    }

    container.appendChild(clone);
    overlay.appendChild(closeBtn);
    overlay.appendChild(container);
    
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden'; // Stop background scrolling

  } else {
    // Cleanup
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
  }
}

function findMainContent() {
  // Priority 1: Explicit Semantic Tags
  const semantic = document.querySelector('article, [role="article"], main, [role="main"]');
  if (semantic && semantic.innerText.length > 500) return semantic;

  // Priority 2: Common Content ID/Classes
  const commonSelectors = [
    '#content', '.content', '#main', '.main', 
    '.post-content', '.article-body', '.entry-content', '#article'
  ];
  
  for (const sel of commonSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.length > 300) return el;
  }

  // Priority 3: Largest Text Block Heuristic
  const blocks = Array.from(document.querySelectorAll('div, section'));
  let bestCandidate = null;
  let maxScore = 0;

  for (const block of blocks) {
    // Skip small or hidden elements
    if (block.offsetHeight < 200 || block.offsetWidth < 200) continue;
    
    const text = block.innerText;
    if (text.length < 500) continue;

    // Calculate Link Density (navs have high density)
    const links = block.querySelectorAll('a');
    const linkLength = Array.from(links).reduce((acc, l) => acc + l.innerText.length, 0);
    const linkDensity = linkLength / text.length;

    // If more than 40% of text is links, it's likely a nav or footer
    if (linkDensity > 0.4) continue;

    const score = text.length * (1 - linkDensity);
    if (score > maxScore) {
      maxScore = score;
      bestCandidate = block;
    }
  }

  return bestCandidate || document.body;
}

function cleanReaderContent(root) {
  // Remove interactive/noise elements
  const garbage = root.querySelectorAll('script, style, noscript, iframe, svg, button, input, textarea, select, form, nav, footer, header, aside, [role="complementary"], .ad, .advertisement, .social-share');
  garbage.forEach(el => el.remove());

  // Strip attributes to reset styling, but keep essentials
  const all = root.querySelectorAll('*');
  all.forEach(el => {
    const tagName = el.tagName;
    
    // Keep styling simple
    el.removeAttribute('class');
    el.removeAttribute('id');
    el.removeAttribute('style');
    
    if (tagName === 'IMG') {
      // Fix images
      el.style.maxWidth = '100%';
      el.style.height = 'auto';
      el.style.display = 'block';
      el.style.margin = '20px auto';
    } else if (tagName === 'A') {
      // Style links
      el.style.color = '#2563eb';
      el.style.textDecoration = 'underline';
    } else if (tagName === 'P' || tagName === 'LI') {
      el.style.marginBottom = '1.5em';
    } else if (/^H[1-6]$/.test(tagName)) {
      el.style.marginTop = '2em';
      el.style.marginBottom = '1em';
      el.style.lineHeight = '1.3';
    }
  });
}

function toggleBionicReading(enable) {
  if (enable) {
    if (isBionicActive) return;
    isBionicActive = true;
    
    const paragraphs = document.querySelectorAll('p, li');
    
    paragraphs.forEach(p => {
      // Skip if inside our own UI
      if (p.closest('#accessmate-toast') || p.closest('#accessmate-reader-view')) return;

      if (!p.dataset.accessmateOriginal) {
        p.dataset.accessmateOriginal = p.innerHTML;
      }
      
      const words = p.innerText.split(' ');
      const bionicHTML = words.map(word => {
        if (word.length < 2) return word;
        const mid = Math.ceil(word.length / 2);
        return `<b>${word.slice(0, mid)}</b>${word.slice(mid)}`;
      }).join(' ');
      
      p.innerHTML = bionicHTML;
    });

  } else {
    isBionicActive = false;
    const paragraphs = document.querySelectorAll('[data-accessmate-original]');
    paragraphs.forEach(p => {
      p.innerHTML = p.dataset.accessmateOriginal;
    });
  }
}

function toggleDyslexiaFont(enable) {
  const id = 'accessmate-dyslexia-style';
  let style = document.getElementById(id);
  
  if (enable) {
    if (!style) {
      style = document.createElement('style');
      style.id = id;
      // Using Comic Sans/Verdana as widely available accessible-friendly fonts fallback
      style.innerHTML = `
        * {
          font-family: 'Comic Sans MS', 'Verdana', 'Arial', sans-serif !important;
          line-height: 1.5 !important;
          letter-spacing: 0.05em !important;
        }
      `;
      document.head.appendChild(style);
    }
  } else {
    if (style) style.remove();
  }
}

function simplifyText() {
  const text = document.body.innerText;
  
  showToast("Simplifying text with AI...");

  chrome.runtime.sendMessage({
    action: 'GEMINI_SIMPLIFY_TEXT',
    text: text
  }, (response) => {
    if (chrome.runtime.lastError) {
        showToast("Error: " + chrome.runtime.lastError.message);
        return;
    }
    if (response && response.summary) {
      showModal("Simplified Summary", response.summary);
    } else if (response && response.error) {
      showToast("Error: " + response.error);
    } else {
      showToast("Failed to simplify text.");
    }
  });
}

// --- Feature 4: Auditory (TTS) ---

function ttsPlay() {
  const selection = window.getSelection().toString();
  // If reader mode is active, prefer reading that content
  const readerView = document.getElementById('accessmate-reader-view');
  const context = readerView || document.body;
  const textToRead = selection || context.innerText;

  if (speechSynthesis.speaking) {
    speechSynthesis.resume();
  } else {
    ttsUtterance = new SpeechSynthesisUtterance(textToRead);
    // Optional: Select a clear voice
    const voices = speechSynthesis.getVoices();
    // Try to find Google US English or similar
    const preferredVoice = voices.find(v => v.name.includes('Google US English')) || voices[0];
    if (preferredVoice) ttsUtterance.voice = preferredVoice;
    
    speechSynthesis.speak(ttsUtterance);
  }
}

function ttsPause() {
  if (speechSynthesis.speaking) {
    speechSynthesis.pause();
  }
}

function ttsStop() {
  speechSynthesis.cancel();
}

// --- UI Helpers (Toast & Modal) ---

function showToast(message) {
  // Remove existing toast
  const existing = document.getElementById('accessmate-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'accessmate-toast';
  toast.innerText = message;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: '#333',
    color: '#fff',
    padding: '12px 24px',
    borderRadius: '8px',
    zIndex: '2147483647', // Max Z-index
    fontFamily: 'sans-serif',
    fontSize: '14px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  });
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.isConnected) toast.remove(); }, 3000);
}

function showModal(title, content) {
  // Simple markdown-to-html for bullet points
  const formattedContent = content.split('\n').map(line => {
    if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
      return `<li>${line.replace(/^[\*\-]\s*/, '')}</li>`;
    }
    return `<p>${line}</p>`;
  }).join('');

  const modalOverlay = document.createElement('div');
  Object.assign(modalOverlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: '2147483647',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  });

  const modalBox = document.createElement('div');
  Object.assign(modalBox.style, {
    backgroundColor: '#fff',
    padding: '30px',
    borderRadius: '12px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    overflowY: 'auto',
    fontFamily: 'sans-serif',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    color: '#333'
  });

  modalBox.innerHTML = `
    <h2 style="margin-top:0; font-size: 24px; color: #111;">${title}</h2>
    <div style="line-height: 1.6; color: #444; margin-top: 15px;">
      ${formattedContent}
    </div>
    <button id="accessmate-close-modal" style="
      margin-top: 20px;
      padding: 10px 20px;
      background-color: #2563eb;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
    ">Close</button>
  `;

  modalOverlay.appendChild(modalBox);
  document.body.appendChild(modalOverlay);

  document.getElementById('accessmate-close-modal').addEventListener('click', () => {
    modalOverlay.remove();
  });
}