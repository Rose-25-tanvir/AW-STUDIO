import { ParsedNode } from '../types';

export const parseXmlToNode = (xmlString: string): ParsedNode | null => {
  if (!xmlString || !xmlString.trim()) return null;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, "text/xml");

    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
      // Return null silently to let the UI handle the error state
      // instead of throwing/logging to console during every keystroke
      return null;
    }

    const root = doc.documentElement;
    if (!root) return null;

    return convertDomNode(root);
  } catch (e) {
    // Silently fail
    return null;
  }
};

const convertDomNode = (node: Element): ParsedNode => {
  const attributes: Record<string, string> = {};
  
  // Extract attributes
  if (node.attributes) {
    for (let i = 0; i < node.attributes.length; i++) {
      const attr = node.attributes[i];
      attributes[attr.name] = attr.value;
    }
  }

  // Extract children
  const children: ParsedNode[] = [];
  let text = "";

  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) {
      children.push(convertDomNode(child as Element));
    } else if (child.nodeType === Node.TEXT_NODE) {
      const val = child.nodeValue?.trim();
      if (val) text = val;
    }
  });

  return {
    tagName: node.tagName,
    attributes,
    children,
    text: text || undefined
  };
};