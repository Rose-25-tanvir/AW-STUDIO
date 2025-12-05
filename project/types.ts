
export interface ParsedNode {
  tagName: string;
  attributes: Record<string, string>;
  children: ParsedNode[];
  text?: string;
}

export interface RendererProps {
  node: ParsedNode;
  depth?: number;
  inputValues?: Record<string, string>;
  onInputChange?: (id: string, value: string) => void;
  onElementClick?: (id: string) => void;
}

export type ItemType = 'file' | 'folder';

export interface FileSystemItem {
  id: string;
  name: string;
  type: ItemType;
  content?: string;
  isOpen?: boolean; // For folders
  children?: FileSystemItem[];
}

export interface ContextMenuState {
  x: number;
  y: number;
  targetId: string | null; // null implies root/empty area
  targetType: ItemType | 'root';
}

export interface RuntimeToast {
  id: string;
  message: string;
  type: 'info' | 'error' | 'custom';
  color?: string; // Custom hex color
  duration?: number; // Duration in seconds
}

export interface RuntimeDialogState {
  isOpen: boolean;
  prompt: string;
}

export interface AwExecutionResult {
  layoutPath: string | null;
}

export interface ConsoleMessage {
  id: string;
  type: 'info' | 'error' | 'input' | 'system';
  content: string;
}

export type InputValues = Record<string, string>;

export type NavigateCallback = (targetPath: string, args: any[]) => void;
export type ToastCallback = (message: string, color?: string, duration?: number) => void;
