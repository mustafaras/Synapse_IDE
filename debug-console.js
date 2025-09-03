// AI Assistant Debug Script - Console'a yapıştırın
// Bu script'i browser console'a yapıştırıp çalıştırın

console.log('🔍 AI Assistant Debug Script Started');

// 1. localStorage kontrol
const AI_SETTINGS_KEY = 'synapse.ai.settings.v2';
const rawSettings = localStorage.getItem(AI_SETTINGS_KEY);
console.log('📱 Raw localStorage:', rawSettings);

if (rawSettings) {
    try {
        const settings = JSON.parse(rawSettings);
        console.log('⚙️ Parsed Settings:', settings);
        console.log('🔑 API Keys:', settings.keys);
        console.log('🎯 OpenAI Key Present:', !!settings.keys?.openai);
        console.log('🎯 OpenAI Key Length:', settings.keys?.openai?.length || 0);
    } catch (e) {
        console.error('❌ Settings Parse Error:', e);
    }
} else {
    console.log('❌ No AI settings found in localStorage');
}

// 2. React state kontrol
console.log('🔍 Looking for React components...');

// React DevTools varsa kullan
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('✅ React DevTools found');
} else {
    console.log('❌ React DevTools not found');
}

// 3. Network requests izle
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const url = args[0];
    if (typeof url === 'string' && (url.includes('openai') || url.includes('api'))) {
        console.log('🌐 API Call:', url, args[1]);
    }
    return originalFetch.apply(this, args);
};

// 4. Console error listener
const originalError = console.error;
console.error = function(...args) {
    console.log('❌ Console Error Detected:', args);
    return originalError.apply(this, args);
};

// 5. Chat mesajları için DOM kontrol
function checkChatDOM() {
    const chatMessages = document.querySelectorAll('[data-testid*="message"], .chat-message, .message-bubble');
    console.log('💬 Found chat elements:', chatMessages.length);
    
    const inputElements = document.querySelectorAll('textarea, input[type="text"]');
    console.log('📝 Found input elements:', inputElements.length);
    
    const buttons = document.querySelectorAll('button');
    console.log('🔘 Found buttons:', buttons.length);
    
    return { chatMessages, inputElements, buttons };
}

// 6. Initial DOM check
setTimeout(() => {
    console.log('🔍 Initial DOM Check:');
    checkChatDOM();
}, 2000);

// 7. Periodic check
setInterval(() => {
    const domState = checkChatDOM();
    if (domState.chatMessages.length === 0) {
        console.log('⚠️ No chat messages found in DOM');
    }
}, 5000);

console.log('✅ Debug script loaded. Check console for updates.');
console.log('💡 Tip: Try sending a message and watch the console for API calls and errors.');
