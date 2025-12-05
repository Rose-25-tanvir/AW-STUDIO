
import React, { useEffect, useState } from 'react';
import { RuntimeToast, RuntimeDialogState } from '../types';
import { X } from 'lucide-react';

interface RuntimeUiProps {
  toasts: RuntimeToast[];
  dialog: RuntimeDialogState;
  onDialogSubmit: (value: string) => void;
  onToastDismiss: (id: string) => void;
}

export const RuntimeUi: React.FC<RuntimeUiProps> = ({ 
  toasts, 
  dialog, 
  onDialogSubmit,
  onToastDismiss
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onDialogSubmit(inputValue);
    setInputValue('');
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden flex flex-col justify-end">
      
      {/* Dialog Overlay */}
      {dialog.isOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-auto p-6 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Input Required</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4 text-sm">{dialog.prompt}</p>
              <form onSubmit={handleSubmit}>
                <input
                  autoFocus
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
                  placeholder="Type here..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <button 
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium text-sm transition-colors"
                  >
                    OK
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Toasts Container */}
      <div className="w-full flex flex-col items-center gap-2 pb-16 px-4 pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id}
            className={`
              pointer-events-auto max-w-[90%] px-4 py-3 rounded-full shadow-lg text-sm font-medium text-white
              animate-in slide-in-from-bottom-5 fade-in duration-300
            `}
            style={{ 
               backgroundColor: toast.color || (toast.type === 'error' ? '#ef4444' : '#323232') 
            }}
            onClick={() => onToastDismiss(toast.id)}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
};
