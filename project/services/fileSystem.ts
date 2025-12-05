
import { FileSystemItem, ItemType } from '../types';

// Helper to generate IDs
export const generateId = () => Math.random().toString(36).substr(2, 9);

// Recursively find an item by ID
export const findItem = (items: FileSystemItem[], id: string): FileSystemItem | null => {
  for (const item of items) {
    if (item.id === id) return item;
    if (item.children) {
      const found = findItem(item.children, id);
      if (found) return found;
    }
  }
  return null;
};

// Find item by path string (e.g., "root/res/layout/main.xml")
export const findItemByPath = (items: FileSystemItem[], path: string): FileSystemItem | null => {
  // Normalize path separators
  const parts = path.split(/[/\\]+/).filter(p => p.length > 0);
  
  let currentItems = items;
  let result: FileSystemItem | null = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const found = currentItems.find(item => item.name === part);
    
    if (!found) return null;
    
    if (i === parts.length - 1) {
      result = found;
    } else {
      if (!found.children) return null;
      currentItems = found.children;
    }
  }
  
  return result;
};

export interface ProjectConfig {
  files: FileSystemItem[];
  entryPoint: string;
}

export const convertJsonToFiles = (jsonData: any): ProjectConfig => {
  // Handle the specific array format [{ main_screen: "...", root: { ... } }]
  let rootData = jsonData;
  let entryPoint = 'root/logic/main/main.aw'; // Default fallback

  if (Array.isArray(jsonData) && jsonData.length > 0) {
    const config = jsonData[0];
    if (config.main_screen) entryPoint = config.main_screen;
    
    if (config.root) {
       rootData = { root: config.root };
    } else {
       rootData = config;
    }
  } else if (jsonData.root) {
     rootData = jsonData;
  }

  const processEntry = (name: string, content: any): FileSystemItem => {
    const isFolder = typeof content === 'object' && content !== null && !Array.isArray(content);
    
    const item: FileSystemItem = {
      id: generateId(),
      name: name,
      type: isFolder ? 'folder' : 'file',
      isOpen: true,
      content: isFolder ? undefined : String(content),
      children: isFolder ? Object.entries(content).map(([k, v]) => processEntry(k, v)) : undefined
    };
    
    return item;
  };

  let files: FileSystemItem[] = [];
  if (rootData.root) {
     files = [processEntry('root', rootData.root)];
  } else {
     files = Object.entries(rootData).map(([k, v]) => processEntry(k, v));
  }

  return { files, entryPoint };
};