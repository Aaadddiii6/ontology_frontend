import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send } from 'lucide-react';
import { MODULE_CONFIGS } from '../../lib/api';
import { ActiveModule, CountryProfile } from '../../types';

interface ChatbotButtonProps {
  activeModule: ActiveModule;
  selectedCountry: CountryProfile | null;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const ChatbotButton: React.FC<ChatbotButtonProps> = ({ activeModule, selectedCountry }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const moduleConfig = MODULE_CONFIGS[activeModule] || MODULE_CONFIGS.overview;

  useEffect(() => {
    if (isOpen) {
      const welcomeText = `Ask me about ${selectedCountry?.country || 'any country\'s'} defence profile, conflict risk, and geopolitical relationships.`;
      setMessages([{ role: 'assistant', text: welcomeText }]);
    } else {
      setMessages([]);
    }
  }, [isOpen, selectedCountry]);

  const handleSend = async () => {
    if (!currentInput.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: currentInput };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setCurrentInput('');
    setIsLoading(true);

    const systemPrompt = `You are a geopolitical intelligence analyst for the Global Intelligence Engine. Current module: ${activeModule}. ${selectedCountry ? `Currently viewing: ${selectedCountry.country} — ${JSON.stringify(selectedCountry)}` : 'No country selected.'} Answer questions about defence profiles, conflict risks, military strength, and geopolitical relationships. Keep answers under 3 sentences. Be specific and data-focused.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-sonnet-20240229',
          max_tokens: 300,
          system: systemPrompt,
          messages: newMessages.map(m => ({ role: m.role, content: m.text })),
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();
      const aiText = data.content[0]?.text || 'Sorry, I couldn\'t process that.';
      setMessages(prev => [...prev, { role: 'assistant', text: aiText }]);
    } catch (error) {
      console.error('Anthropic API error:', error);
      setMessages(prev => [...prev, { role: 'assistant', text: 'An error occurred. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <motion.button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-5 z-[200] w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg"
        style={{ backgroundColor: moduleConfig.accent }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <MessageCircle size={22} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-[144px] right-5 w-[320px] h-[440px] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden z-[200]"
          >
            {/* Header */}
            <div
              className="flex items-center justify-between h-12 px-4 border-b shrink-0"
              style={{ borderColor: `${moduleConfig.accent}40` }}
            >
              <span className="text-sm font-bold">GIE Intelligence</span>
              <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 p-3 space-y-3 overflow-y-auto">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`px-3 py-2 rounded-xl max-w-[85%] text-sm ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}
                    style={{
                      backgroundColor: msg.role === 'user' ? moduleConfig.accent : '#f5f4fb',
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                    <div className="px-3 py-2 rounded-xl bg-gray-100 text-gray-500">
                        <div className="flex gap-1 items-center">
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-0" />
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150" />
                            <span className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300" />
                        </div>
                    </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex items-center h-12 p-1.5 border-t">
              <input
                type="text"
                value={currentInput}
                onChange={e => setCurrentInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask a question..."
                className="flex-1 h-full px-3 text-sm bg-transparent focus:outline-none"
                disabled={isLoading}
              />
              <button
                onClick={handleSend}
                disabled={isLoading}
                className="w-9 h-9 flex items-center justify-center rounded-full text-white transition-opacity"
                style={{ backgroundColor: moduleConfig.accent, opacity: isLoading ? 0.6 : 1 }}
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatbotButton;
