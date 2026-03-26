import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const useA11y = () => {
  const [settings, setSettings] = useState(() => {
    if (typeof window === 'undefined') {
      return { fontSize: 'M', highContrast: false, reduceMotion: false };
    }
    const saved = localStorage.getItem('gie-a11y');
    return saved ? JSON.parse(saved) : { fontSize: 'M', highContrast: false, reduceMotion: false };
  });

  useEffect(() => {
    localStorage.setItem('gie-a11y', JSON.stringify(settings));

    const sizeMap: { [key: string]: string } = { S: '14px', M: '16px', L: '18px', XL: '21px' };
    document.documentElement.style.setProperty('--font-size-base', sizeMap[settings.fontSize]);
    document.documentElement.classList.toggle('high-contrast', settings.highContrast);
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);

  }, [settings]);

  return [settings, setSettings];
};

const AccessibilityPanel: React.FC = () => {
  const [settings, setSettings] = useA11y();
  const [isOpen, setIsOpen] = useState(false);

  const updateSetting = (key: string, value: any) => {
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-[144px] right-5 z-[200] w-10 h-10 rounded-full flex items-center justify-center bg-white border border-gray-300 shadow-md"
      >
        <span className="text-sm font-bold text-gray-700">Aa</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed bottom-[192px] right-5 w-[240px] bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-[200]"
          >
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-700">Text size</label>
              <div className="grid grid-cols-4 gap-1 mt-2">
                {['S', 'M', 'L', 'XL'].map(size => (
                  <button
                    key={size}
                    onClick={() => updateSetting('fontSize', size)}
                    className={`p-2 rounded-md text-xs font-bold ${settings.fontSize === size ? 'bg-slate-800 text-white' : 'bg-gray-200 text-gray-700'}`}>
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-t">
              <label htmlFor="highContrast" className="text-sm font-medium text-gray-700">High contrast</label>
              <input type="checkbox" id="highContrast" checked={settings.highContrast} onChange={e => updateSetting('highContrast', e.target.checked)} />
            </div>

            <div className="flex items-center justify-between py-2 border-t">
              <label htmlFor="reduceMotion" className="text-sm font-medium text-gray-700">Reduce motion</label>
              <input type="checkbox" id="reduceMotion" checked={settings.reduceMotion} onChange={e => updateSetting('reduceMotion', e.target.checked)} />
            </div>

            <div className="pt-3 mt-2 border-t">
                <p className="text-[10px] text-gray-400 leading-snug">Tab — next country</p>
                <p className="text-[10px] text-gray-400 leading-snug">Enter — select</p>
                <p className="text-[10px] text-gray-400 leading-snug">Esc — close panel</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AccessibilityPanel;
