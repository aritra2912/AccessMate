importScripts('utils.js');

// Listen for messages from Content Script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === 'GEMINI_ANALYZE_IMAGE') {
    handleImageAnalysis(request.imageUrl, sendResponse);
    return true; // Keep message channel open for async response
  }

  if (request.action === 'GEMINI_SIMPLIFY_TEXT') {
    handleTextSimplification(request.text, sendResponse);
    return true; // Keep message channel open
  }

});

async function handleImageAnalysis(imageUrl, sendResponse) {
  try {
    // 1. Get API Key
    const data = await chrome.storage.local.get(['geminiApiKey']);
    const apiKey = data.geminiApiKey;
    if (!apiKey) {
      sendResponse({ error: 'No API Key' });
      return;
    }

    // 2. Fetch the image to get base64
    // We do this in background because content script might be blocked by CORS
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    
    // Convert Blob to Base64
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64data = reader.result;
      
      // 3. Call Gemini
      // Using gemini-3-flash-preview as it supports multimodal inputs (text + image)
      const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
      const prompt = createGeminiVisionPrompt(base64data, "Describe this image concisely in one sentence for a blind user (alt text).");
      
      try {
        const aiReq = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(prompt)
        });
        
        if (!aiReq.ok) {
           const errText = await aiReq.text();
           throw new Error(`API Error ${aiReq.status}: ${errText}`);
        }

        const aiRes = await aiReq.json();
        const description = aiRes.candidates?.[0]?.content?.parts?.[0]?.text || "Image";
        sendResponse({ description });
      } catch (err) {
        console.error("Gemini Error", err);
        sendResponse({ error: err.message });
      }
    };
    reader.onerror = () => sendResponse({ error: "Failed to read image data" });
    reader.readAsDataURL(blob);

  } catch (err) {
    console.error("Image Fetch Error", err);
    sendResponse({ error: "Failed to fetch image" });
  }
}

async function handleTextSimplification(textContent, sendResponse) {
  try {
    const data = await chrome.storage.local.get(['geminiApiKey']);
    const apiKey = data.geminiApiKey;
    if (!apiKey) {
      sendResponse({ error: 'No API Key' });
      return;
    }

    // Truncate text to avoid excessive token usage
    const truncatedText = textContent.slice(0, 8000); 

    // Using gemini-3-flash-preview for text tasks
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;
    const prompt = createGeminiPrompt(truncatedText, "Summarize the following text into simple, plain English bullet points. Make it easy to read for someone with cognitive disabilities.");

    const aiReq = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt)
    });
    
    if (!aiReq.ok) {
        const errText = await aiReq.text();
        throw new Error(`API Error ${aiReq.status}: ${errText}`);
    }

    const aiRes = await aiReq.json();
    const summary = aiRes.candidates?.[0]?.content?.parts?.[0]?.text || "Could not simplify text.";
    sendResponse({ summary });

  } catch (err) {
    console.error("Simplification Error", err);
    sendResponse({ error: err.message });
  }
}