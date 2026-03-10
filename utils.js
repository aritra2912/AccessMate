// Utility to format the Gemini API prompt
function createGeminiPrompt(text, systemInstruction) {
    return {
      contents: [{
        parts: [{ text: systemInstruction + "\n\n" + text }]
      }]
    };
  }
  
  // Utility to format Gemini Vision prompt
  function createGeminiVisionPrompt(base64Image, promptText) {
    // Remove header from base64 string if present (data:image/jpeg;base64,...)
    const cleanBase64 = base64Image.split(',')[1] || base64Image;
    
    return {
      contents: [{
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          }
        ]
      }]
    };
  }

  // Export for node/module environments if needed, but in vanilla extension we use importScripts or global scope
  if (typeof module !== 'undefined') {
    module.exports = { createGeminiPrompt, createGeminiVisionPrompt };
  }