
import { parseXmlToNode } from './xmlParser';
import { ParsedNode } from '../types';
import { NavigateCallback, ToastCallback } from '../types';

export type OutputCallback = (text: string) => void;
export type InputCallback = (prompt: string) => Promise<string>;
export type FileLoader = (path: string) => string | null;

export interface DomInterface {
  getValue: (id: string) => string;
  setValue: (id: string, property: string, value: string) => void;
}

interface FunctionDef {
  params: string[];
  bodyLines: string[];
}

interface Scope {
  vars: Record<string, any>;
  eventHandlers: Record<string, string[]>; // Map ID -> Block of code lines
  functions: Record<string, FunctionDef>;
}

export class AwInterpreter {
  private scope: Scope = { vars: {}, eventHandlers: {}, functions: {} };
  private outputCb: OutputCallback;
  private inputCb: InputCallback;
  private navigateCb: NavigateCallback;
  private toastCb: ToastCallback;
  private fileLoader: FileLoader;
  private dom?: DomInterface;
  private intentData: any[] = [];

  constructor(
    outputCb: OutputCallback, 
    inputCb: InputCallback,
    navigateCb: NavigateCallback,
    toastCb: ToastCallback,
    fileLoader: FileLoader,
    dom?: DomInterface,
    initialIntentData: any[] = []
  ) {
    this.outputCb = outputCb;
    this.inputCb = inputCb;
    this.navigateCb = navigateCb;
    this.toastCb = toastCb;
    this.fileLoader = fileLoader;
    this.dom = dom;
    this.intentData = initialIntentData;
  }

  public updateDomInterface(dom: DomInterface) {
    this.dom = dom;
  }

  // Parse path from the variable declaration after start
  public parseLayoutPath(code: string): string | null {
    const lines = code.split('\n');
    const startIdx = lines.findIndex(l => l.trim().startsWith('THE CODE IS START NOW'));
    if (startIdx === -1) return null;
    
    for (let i = startIdx + 1; i < Math.min(startIdx + 10, lines.length); i++) {
        const line = lines[i].trim();
        const match = line.match(/^\s*(\w+)\s*=\s*(root\/.*)\s*$/);
        if (match) {
            return match[2].trim();
        }
    }
    return null;
  }

  // Parse Metadata (Title, Icon) from Header
  public parseAppMetadata(code: string): { title?: string, icon?: string } {
    const lines = code.split('\n');
    const startIdx = lines.findIndex(l => l.trim() === 'WELCOM IN AW');
    const endIdx = lines.findIndex(l => l.trim() === 'THE CODE IS START NOW');
    
    if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) return {};

    const headerLines = lines.slice(startIdx + 1, endIdx);
    let title: string | undefined;
    let icon: string | undefined;

    for (const line of headerLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Title parsing: titel : "Value", or title : Value
        const titleMatch = trimmed.match(/^(?:titel|title)\s*:\s*(.*)/i);
        if (titleMatch) {
            let val = titleMatch[1].trim();
            if (val.endsWith(',')) val = val.slice(0, -1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            title = val;
        }
        
        // Icon parsing: icon : "Url"
        const iconMatch = trimmed.match(/^icon\s*:\s*(.*)/i);
        if (iconMatch) {
            let val = iconMatch[1].trim();
            if (val.endsWith(',')) val = val.slice(0, -1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            }
            icon = val;
        }
    }
    
    return { title, icon };
  }

  public async execute(code: string) {
    // We only reset vars if it's a fresh run, but we keep them for event handling
    this.scope = { vars: {}, eventHandlers: {}, functions: {} }; 
    
    let cleanCode = code.replace(/\*\*\/(.|\n)*?\/\*\*/g, '');
    let lines = cleanCode.split('\n').map(l => l.trim()).filter(l => l);

    const startIdx = lines.findIndex(l => l.startsWith('THE CODE IS START NOW'));
    if (startIdx !== -1) {
      lines = lines.slice(startIdx + 1);
    }
    if (lines[0] === 'WELCOM IN AW') lines.shift(); 

    await this.processBlock(lines);
  }

  public async triggerEvent(elementId: string) {
    const handler = this.scope.eventHandlers[elementId];
    if (handler) {
      // Execute the stored block in the current scope
      await this.processBlock(handler);
    }
  }

  private async processBlock(lines: string[]) {
    let i = 0;
    while (i < lines.length) {
      let line = lines[i];

      // FUNCTION Definition: func name {params} { ... }
      if (line.startsWith('func ')) {
        const match = line.match(/^func\s+([a-zA-Z0-9_]+)\s*\{(.*?)\}/);
        if (match) {
           const name = match[1];
           // Clean parameters: remove whitespace and leading '&&' if user typed 'func name {&&a, &&b}'
           const params = match[2].split(',').map(p => {
              let clean = p.trim();
              if (clean.startsWith('&&')) clean = clean.substring(2);
              return clean;
           }).filter(p => p);

           const { blockLines, nextIndex } = this.extractBlock(lines, i);
           
           this.scope.functions[name] = { params, bodyLines: blockLines };
           this.outputCb(`System: Defined function '${name}'`);
           
           // Skip execution of declaration
           i = nextIndex;
           continue;
        }
      }

      // EVENT LISTENER: is.press.&&btn { ... }
      if (line.startsWith('is.press.')) {
        const match = line.match(/^is\.press\.(?:&&)?([a-zA-Z0-9_.]+)/);
        if (match) {
           const varRef = match[1];
           // Resolve variable to an element ID
           const resolved = this.resolveVariableReference(varRef);
           
           let targetId: string | null = null;
           if (resolved && typeof resolved === 'object' && resolved.attributes && resolved.attributes['android:id']) {
              targetId = resolved.attributes['android:id'].replace('@+id/', '').replace('@id/', '');
           }

           const { blockLines, nextIndex } = this.extractBlock(lines, i);
           
           if (targetId) {
             this.scope.eventHandlers[targetId] = blockLines;
             this.outputCb(`System: Registered click listener for ID '${targetId}'`);
           } else {
             this.outputCb(`Error: Could not resolve '${varRef}' to a UI element ID for event listener.`);
           }

           i = nextIndex;
           continue;
        }
      }

      // IF Block
      if (line.startsWith('if')) {
        const { blockLines, nextIndex, matched } = await this.handleConditional(lines, i);
        if (matched && blockLines.length > 0) {
          await this.processBlock(blockLines);
        }
        i = nextIndex;
        continue;
      }
      
      // Loops
      if (line.startsWith('for') || line.startsWith('while')) {
        const conditionStr = this.extractCondition(line);
        const { blockLines, nextIndex } = this.extractBlock(lines, i);
        
        if (conditionStr) {
           let loopSafety = 0;
           while (this.evaluateCondition(conditionStr) && loopSafety < 1000) {
             await this.processBlock(blockLines);
             loopSafety++;
           }
           if (loopSafety >= 1000) this.outputCb("Error: Infinite loop detected.");
        }
        i = nextIndex;
        continue;
      }

      // NAVIGATION: intent.to.&&target[args]
      if (line.startsWith('intent.to.')) {
        const intentMatch = line.match(/^intent\.to\.([a-zA-Z0-9_&.]+)(?:\[(.*)\])?/);
        
        if (intentMatch) {
            const targetRef = intentMatch[1];
            const argsStr = intentMatch[2] || '';
            
            let targetPath = '';
            if (targetRef.startsWith('&&')) {
                targetPath = this.resolveVariableReference(targetRef.substring(2));
            } else {
                const potentialVar = this.scope.vars[targetRef];
                targetPath = potentialVar !== undefined ? potentialVar : targetRef;
            }

            const args = this.splitArgs(argsStr).map(a => this.evaluateExpression(a));
            
            this.outputCb(`System: Navigating to ${targetPath} with data: ${JSON.stringify(args)}`);
            this.navigateCb(targetPath, args);
            return; // Stop execution
        }
      }

      // TOAST: toast{text, color, time}
      // Example: toast{Hello World, #ff0000, 5}
      if (line.startsWith('toast{')) {
        const content = line.substring(line.indexOf('{') + 1, line.lastIndexOf('}'));
        const args = this.splitArgs(content).map(a => this.evaluateExpression(a));
        
        const text = String(args[0] || '');
        const color = args[1] ? String(args[1]) : '#333333';
        const time = args[2] ? Number(args[2]) : 2;

        this.toastCb(text, color, time);
        i++;
        continue;
      }

      // FUNCTION CALL: name{args}
      const callMatch = line.match(/^([a-zA-Z0-9_]+)\{(.*)\}\s*$/);
      if (callMatch) {
         const name = callMatch[1];
         if (this.scope.functions[name]) {
             const argsStr = callMatch[2];
             const args = this.splitArgs(argsStr).map(a => this.evaluateExpression(a));
             
             const funcDef = this.scope.functions[name];
             
             // Backup current scope vars that might be overwritten (simple approach)
             funcDef.params.forEach((param, idx) => {
                 if (idx < args.length) {
                     this.scope.vars[param] = args[idx];
                 }
             });
             
             await this.processBlock(funcDef.bodyLines);
             i++;
             continue;
         }
      }

      // Basic Commands
      await this.processLine(line);
      i++;
    }
  }

  // Helper to split arguments by comma, respecting quotes
  private splitArgs(str: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuote = false;
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '"') inQuote = !inQuote;
      if (char === ',' && !inQuote) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result.map(s => s.trim()).filter(s => s !== '');
  }

  private async processLine(line: string) {
    if (line.includes('=')) {
      const parts = line.split('=');
      const lhs = parts[0].trim();
      let rhs = parts.slice(1).join('=').trim();
      
      const setterRegex = /(?:&&)?([a-zA-Z0-9_.]+)\.([a-zA-Z0-9_]+)\[(.*)\]$/;
      const setterMatch = rhs.match(setterRegex);

      if (setterMatch) {
        // It's either a UI Setter OR a Variable Getter (like intent.data)
        const objPath = setterMatch[1];
        const prop = setterMatch[2];
        const valExpr = setterMatch[3];
        
        const resolvedObj = this.resolveVariableReference(objPath);
        
        // CHECK: Is this actually a valid UI Element?
        if (resolvedObj && typeof resolvedObj === 'object' && 'attributes' in resolvedObj && this.dom) {
            const val = this.evaluateExpression(valExpr);
            const id = resolvedObj.attributes['android:id']?.replace('@+id/', '').replace('@id/', '');
            if (id) {
               this.dom.setValue(id, prop, String(val));
               this.scope.vars[lhs] = val; 
            }
            return; // Handled as Setter, stop processing
        }
        // If not a valid DOM node, fall through to normal assignment (e.g. data = &&ui.intent.data[0])
      }

      // Normal Assignment
      if (rhs.startsWith('inp(')) {
         const prompt = rhs.substring(4, rhs.lastIndexOf(')'));
         const userVal = await this.inputCb(prompt);
         this.scope.vars[lhs] = isNaN(Number(userVal)) ? userVal : Number(userVal);
         return;
      }

      if (rhs.startsWith('root/')) {
          const content = this.fileLoader(rhs);
          let assigned = false;

          if (content) {
              const rootNode = parseXmlToNode(content);
              if (rootNode) {
                  this.scope.vars[lhs] = rootNode; // Save node
                  this.scope.vars[lhs + '_path'] = rhs; 
                  this.outputCb(`System: Loaded layout into variable '${lhs}'`);
                  assigned = true;
              }
          } 
          
          if (!assigned) {
             this.scope.vars[lhs] = rhs;
          }
          return;
      }

      const val = this.evaluateExpression(rhs);
      this.scope.vars[lhs] = val;
      return;
    }

    // Print
    if (line.startsWith('print(') || line.startsWith('show(')) {
      const content = line.substring(line.indexOf('(') + 1, line.lastIndexOf(')'));
      const resolved = this.evaluateExpression(content);
      let outputStr = '';
      if (typeof resolved === 'object') {
          outputStr = `[Object: ${resolved.tagName} id=${resolved.attributes['android:id'] || 'null'}]`;
      } else {
          outputStr = String(resolved);
      }
      this.outputCb(outputStr);
    }
  }

  private async handleConditional(lines: string[], startIndex: number): Promise<{ blockLines: string[], nextIndex: number, matched: boolean }> {
      let currentIndex = startIndex;
      let line = lines[currentIndex];
      
      let condition = this.extractCondition(line);
      let blockData = this.extractBlock(lines, currentIndex);
      
      if (this.evaluateCondition(condition)) {
         return { blockLines: blockData.blockLines, nextIndex: this.findEndOfChain(lines, currentIndex), matched: true };
      }
      
      currentIndex = blockData.nextIndex;
      while (currentIndex < lines.length && lines[currentIndex].startsWith('.elif')) {
         line = lines[currentIndex];
         condition = this.extractCondition(line);
         blockData = this.extractBlock(lines, currentIndex);
         
         if (this.evaluateCondition(condition)) {
            return { blockLines: blockData.blockLines, nextIndex: this.findEndOfChain(lines, startIndex), matched: true };
         }
         currentIndex = blockData.nextIndex;
      }
      
      if (currentIndex < lines.length && lines[currentIndex].startsWith('.else')) {
         blockData = this.extractBlock(lines, currentIndex);
         return { blockLines: blockData.blockLines, nextIndex: blockData.nextIndex, matched: true };
      }

      return { blockLines: [], nextIndex: currentIndex, matched: false };
  }

  private findEndOfChain(lines: string[], startIndex: number): number {
    let i = startIndex;
    let block = this.extractBlock(lines, i);
    i = block.nextIndex;
    
    while(i < lines.length) {
      if (lines[i].startsWith('.elif') || lines[i].startsWith('.else')) {
        block = this.extractBlock(lines, i);
        i = block.nextIndex;
      } else {
        break;
      }
    }
    return i;
  }

  private extractBlock(lines: string[], index: number): { blockLines: string[], nextIndex: number } {
     let line = lines[index];
     let collected: string[] = [];
     
     if (line.trim().endsWith('}')) {
        const lastOpen = line.lastIndexOf('{');
        const lastClose = line.lastIndexOf('}');
        if (lastOpen > -1 && lastClose > lastOpen) {
           collected.push(line.substring(lastOpen + 1, lastClose));
           return { blockLines: collected, nextIndex: index + 1 };
        }
     }

     let balance = 0;
     if (line.includes('{')) balance += (line.match(/{/g) || []).length;
     if (line.includes('}')) balance -= (line.match(/}/g) || []).length;
     
     let i = index + 1;
     while (i < lines.length && balance > 0) {
       const l = lines[i];
       if (l.includes('{')) balance += (l.match(/{/g) || []).length;
       if (l.includes('}')) balance -= (l.match(/}/g) || []).length;
       
       if (balance >= 0) {
          if (balance === 0) {} else {
             collected.push(l);
          }
       }
       i++;
     }
     
     return { blockLines: collected, nextIndex: i };
  }

  private extractCondition(line: string): string {
    const firstOpen = line.indexOf('{');
    const firstClose = line.lastIndexOf('}');
    if (firstOpen !== -1 && firstClose !== -1) {
      return line.substring(firstOpen + 1, firstClose);
    }
    return 'false';
  }

  private evaluateCondition(cond: string): boolean {
    const expr = this.resolveVariablesForEval(cond);
    try {
      // eslint-disable-next-line no-new-func
      return new Function(`return ${expr}`)();
    } catch (e) {
      return false;
    }
  }

  private evaluateExpression(expr: string): any {
    if (expr.startsWith('&&') && !expr.includes(' ') && !expr.includes('+') && !expr.includes('*') && !expr.includes(':')) {
       return this.resolveVariableReference(expr.substring(2));
    }

    // Fix for URLs being interpreted as Label + Comment (e.g. https://...) resulting in undefined
    if (/^https?:\/\//i.test(expr)) {
       return expr.trim();
    }

    const evalExpr = this.resolveVariablesForEval(expr);
    try {
      if (/^[a-zA-Z0-9_]+:/.test(expr)) {
          throw new Error("Potential label detected, using string fallback");
      }
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${evalExpr}`)();
      // If result is undefined but input looked valid, it might have been an eval error swallowed by the JS engine logic above
      if (result === undefined && expr.length > 0) {
         return this.resolveVariablesForDisplay(expr).trim();
      }
      return typeof result === 'string' ? result.trim() : result;
    } catch (e) {
      const res = this.resolveVariablesForDisplay(expr);
      return typeof res === 'string' ? res.trim() : res;
    }
  }

  private resolveVariableReference(varPath: string): any {
     if (varPath.startsWith('ui.intent.data')) {
        const indexMatch = varPath.match(/\[(\d+)\]/);
        if (indexMatch) {
            const idx = parseInt(indexMatch[1], 10);
            return this.intentData[idx] !== undefined ? this.intentData[idx] : 'null';
        }
     }

     const parts = varPath.split('.');
     const rootVar = parts[0];
     
     let current = this.scope.vars[rootVar];
     if (current === undefined) return `&&${varPath}`; 

     for (let i = 1; i < parts.length; i++) {
         const key = parts[i];
         if (current && current.children) {
             const found = this.findChildById(current, key);
             if (found) {
                 current = found;
             } else {
                 return undefined;
             }
         } else {
             return undefined;
         }
     }
     
     if (current && typeof current === 'object' && current.tagName === 'EditText') {
        const id = current.attributes['android:id']?.replace('@+id/', '').replace('@id/', '');
        if (id && this.dom) {
            return this.dom.getValue(id);
        }
     }

     return current;
  }
  
  private findChildById(node: ParsedNode, id: string): ParsedNode | undefined {
      if (node.attributes['android:id']?.includes(id)) return node;

      for (const child of node.children) {
          const found = this.findDescendantById(child, id);
          if (found) return found;
      }
      return undefined;
  }

  private findDescendantById(node: ParsedNode, id: string): ParsedNode | undefined {
     const nodeId = node.attributes['android:id']?.replace('@+id/', '').replace('@id/', '');
     if (nodeId === id || node.tagName === id) return node;
     
     for (const child of node.children) {
         const found = this.findDescendantById(child, id);
         if (found) return found;
     }
     return undefined;
  }

  private resolveVariablesForEval(text: string): string {
    return text.replace(/&&([a-zA-Z0-9_.[\]]+)/g, (_, varPath) => {
      const val = this.resolveVariableReference(varPath);
      if (typeof val === 'object') return `[Object]`;
      return val !== undefined ? (typeof val === 'string' ? `"${val}"` : String(val)) : `&&${varPath}`;
    });
  }

  private resolveVariablesForDisplay(text: string): string {
    return text.replace(/&&([a-zA-Z0-9_.[\]]+)/g, (_, varPath) => {
      const val = this.resolveVariableReference(varPath);
      if (typeof val === 'object') return `[Object]`;
      return val !== undefined ? String(val) : `&&${varPath}`;
    });
  }
}
