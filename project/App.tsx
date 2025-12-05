
import React, { useState, useEffect, useRef } from 'react';
import { parseXmlToNode } from './services/xmlParser';
import { ParsedNode, FileSystemItem, RuntimeToast, RuntimeDialogState, InputValues } from './types';
import { XmlRenderer } from './components/XmlRenderer';
import { findItemByPath, generateId, convertJsonToFiles } from './services/fileSystem';
import { AwInterpreter, DomInterface } from './services/awInterpreter';
import { RuntimeUi } from './components/RuntimeUi';
import { PROJECT_DATA } from './projectData';

const App: React.FC = () => {
  // --- STATE ---
  const [files, setFiles] = useState<FileSystemItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // PWA Install State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // Runtime State
  const [runtimeParsedRoot, setRuntimeParsedRoot] = useState<ParsedNode | null>(null); 
  const [runtimeInputValues, setRuntimeInputValues] = useState<InputValues>({});
  
  // Inputs Ref (for Interpreter access)
  const runtimeInputValuesRef = useRef<InputValues>({});
  
  // UI Overlays
  const [toasts, setToasts] = useState<RuntimeToast[]>([]);
  const [dialog, setDialog] = useState<RuntimeDialogState>({ isOpen: false, prompt: '' });
  
  // Refs
  const inputResolver = useRef<((val: string) => void) | null>(null);
  const interpreterRef = useRef<AwInterpreter | null>(null);
  const filesRef = useRef<FileSystemItem[]>([]);

  // Sync refs
  useEffect(() => {
    runtimeInputValuesRef.current = runtimeInputValues;
  }, [runtimeInputValues]);

  // --- INITIALIZATION ---
  useEffect(() => {
    // 1. Load File System from Project Data (TS)
    const { files: fileSystem, entryPoint } = convertJsonToFiles(PROJECT_DATA);
    setFiles(fileSystem);
    filesRef.current = fileSystem;
    
    // 2. Start the App automatically
    loadAndRunAw(entryPoint);
    setIsLoaded(true);

    // 3. PWA Install Handler
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault(); // Prevent mini-infobar
      setDeferredPrompt(e); // Stash event
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // --- RUNTIME LOGIC ---
  const domInterface: DomInterface = {
    getValue: (id) => {
      return runtimeInputValuesRef.current[id] || '';
    },
    setValue: (id, property, value) => {
      setRuntimeParsedRoot(prev => {
        if (!prev) return null;
        const updateNode = (node: ParsedNode): ParsedNode => {
            const nodeId = node.attributes['android:id']?.replace('@+id/', '').replace('@id/', '');
            if (nodeId === id) {
              const newAttrs = { ...node.attributes };
              if (property === 'text') {
                  newAttrs['android:text'] = value;
                  return { ...node, attributes: newAttrs, text: value };
              }
              if (property === 'image') {
                  newAttrs['android:src'] = value;
                  return { ...node, attributes: newAttrs };
              }
            }
            return { ...node, children: node.children.map(updateNode) };
        };
        return updateNode(prev);
      });
    }
  };

  const loadAndRunAw = async (path: string, intentData: any[] = []) => {
    // 1. Find the AW File
    let scriptFile = findItemByPath(filesRef.current, path);
    if (!scriptFile) scriptFile = findItemByPath(filesRef.current, path + '.aw');

    if (!scriptFile || !scriptFile.content) {
      console.error(`Script not found: ${path}`);
      setToasts(prev => [...prev, { id: generateId(), message: `Error: Script not found ${path}`, type: 'error', duration: 3 }]);
      return;
    }

    // Reset inputs for new screen
    setRuntimeInputValues({}); 

    // 2. Initialize Interpreter
    interpreterRef.current = new AwInterpreter(
      (text) => console.log(`[AW]: ${text}`), // Log to dev console only
      (prompt) => {
        return new Promise((resolve) => {
          setDialog({ isOpen: true, prompt });
          inputResolver.current = resolve;
        });
      },
      (targetPath, args) => loadAndRunAw(targetPath, args),
      (message, color, duration) => {
         const id = generateId();
         setToasts(prev => [...prev, { id, message, type: 'custom', color, duration }]);
         setTimeout(() => {
           setToasts(prev => prev.filter(t => t.id !== id));
         }, (duration || 2) * 1000);
      },
      (p) => {
         let f = findItemByPath(filesRef.current, p);
         if (!f) f = findItemByPath(filesRef.current, p + '.aw');
         return f ? f.content || null : null;
      },
      domInterface,
      intentData
    );

    // 3. APPLY METADATA (Title/Icon)
    const { title, icon } = interpreterRef.current.parseAppMetadata(scriptFile.content);
    if (title) document.title = title;
    if (icon) {
        // Remove generic favicons or previous dynamic ones to force update
        const existingLinks = document.querySelectorAll("link[rel*='icon']");
        existingLinks.forEach(el => el.remove());

        const link = document.createElement('link');
        link.rel = 'shortcut icon';
        link.href = icon;
        // Do NOT force type='image/x-icon' here, let the browser detect jpg/png
        document.head.appendChild(link);
    }

    // 4. Parse Linked XML Layout
    const layoutPath = interpreterRef.current.parseLayoutPath(scriptFile.content);
    if (layoutPath) {
        const layoutFile = findItemByPath(filesRef.current, layoutPath);
        if (layoutFile && layoutFile.content) {
           const root = parseXmlToNode(layoutFile.content);
           if (root) {
             setRuntimeParsedRoot(root);
             // 5. Execute Logic
             try {
                await interpreterRef.current.execute(scriptFile.content);
             } catch (e) {
                console.error(e);
             }
           } else {
             console.error(`XML Error in ${layoutPath}`);
           }
        } else {
           console.error(`Layout file not found: ${layoutPath}`);
        }
    }
  };

  // --- UI HANDLERS ---
  const handleDialogSubmit = (val: string) => {
    if (inputResolver.current) {
      inputResolver.current(val);
      inputResolver.current = null;
      setDialog(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleRuntimeInputChange = (id: string, val: string) => {
    setRuntimeInputValues(prev => ({ ...prev, [id]: val }));
  };

  const handleElementClick = (id: string) => {
    if (interpreterRef.current) {
      interpreterRef.current.triggerEvent(id);
    }
  };

  return (
    <div className="w-full h-screen bg-black text-white overflow-hidden relative">
      {!isLoaded ? (
        <div className="w-full h-full flex items-center justify-center text-gray-500 font-medium animate-pulse">
          Loading Application...
        </div>
      ) : (
        <>
           {/* PWA Install Button */}
           {deferredPrompt && (
             <div className="absolute top-4 right-4 z-[100]">
               <button
                 onClick={handleInstallClick}
                 className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full font-semibold shadow-lg transition-transform active:scale-95 animate-in fade-in slide-in-from-top-4"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                 Install App
               </button>
             </div>
           )}

           <div className="w-full h-full overflow-y-auto custom-scrollbar bg-white text-gray-900">
             {runtimeParsedRoot ? (
               <XmlRenderer 
                 node={runtimeParsedRoot} 
                 inputValues={runtimeInputValues}
                 onInputChange={handleRuntimeInputChange}
                 onElementClick={handleElementClick}
               />
             ) : (
               <div className="h-full flex items-center justify-center text-gray-400">
                 Loading Screen...
               </div>
             )}
           </div>

           {/* Runtime UI Overlay */}
           <RuntimeUi 
              toasts={toasts}
              dialog={dialog}
              onDialogSubmit={handleDialogSubmit}
              onToastDismiss={handleDismissToast}
           />
        </>
      )}
    </div>
  );
};

export default App;
