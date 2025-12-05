
import React from 'react';
import { ParsedNode, RendererProps } from '../types';

// Helper to convert android style strings to CSS properties
const getStyleFromAttributes = (attrs: Record<string, string>) => {
  const style: React.CSSProperties = {};
  const className: string[] = [];

  // Dimensions
  const w = attrs['android:layout_width'];
  const h = attrs['android:layout_height'];

  if (w === 'match_parent') className.push('w-full');
  else if (w === 'wrap_content') className.push('w-auto');
  else if (w) style.width = w.replace('dp', 'px');

  if (h === 'match_parent') className.push('h-full');
  else if (h === 'wrap_content') className.push('h-auto');
  else if (h) style.height = h.replace('dp', 'px');

  // Background
  if (attrs['android:background']) {
    style.backgroundColor = attrs['android:background'];
  }

  // Padding
  if (attrs['android:padding']) style.padding = attrs['android:padding'].replace('dp', 'px');
  if (attrs['android:paddingTop']) style.paddingTop = attrs['android:paddingTop'].replace('dp', 'px');
  if (attrs['android:paddingBottom']) style.paddingBottom = attrs['android:paddingBottom'].replace('dp', 'px');
  if (attrs['android:paddingLeft']) style.paddingLeft = attrs['android:paddingLeft'].replace('dp', 'px');
  if (attrs['android:paddingRight']) style.paddingRight = attrs['android:paddingRight'].replace('dp', 'px');

  // Margins
  if (attrs['android:layout_margin']) style.margin = attrs['android:layout_margin'].replace('dp', 'px');
  if (attrs['android:layout_marginTop']) style.marginTop = attrs['android:layout_marginTop'].replace('dp', 'px');
  if (attrs['android:layout_marginBottom']) style.marginBottom = attrs['android:layout_marginBottom'].replace('dp', 'px');
  if (attrs['android:layout_marginLeft']) style.marginLeft = attrs['android:layout_marginLeft'].replace('dp', 'px');
  if (attrs['android:layout_marginRight']) style.marginRight = attrs['android:layout_marginRight'].replace('dp', 'px');

  // Text Styling
  if (attrs['android:textSize']) style.fontSize = attrs['android:textSize'].replace('sp', 'px');
  if (attrs['android:textColor']) style.color = attrs['android:textColor'];
  if (attrs['android:textStyle'] === 'bold') style.fontWeight = 'bold';
  if (attrs['android:textStyle'] === 'italic') style.fontStyle = 'italic';
  if (attrs['android:textAlignment'] === 'center') style.textAlign = 'center';

  // LinearLayout specifics
  if (attrs['android:orientation'] === 'vertical') {
    className.push('flex flex-col');
  } else if (attrs['android:orientation'] === 'horizontal') {
    className.push('flex flex-row');
  }

  // Gravity (Alignment)
  const gravity = attrs['android:gravity'] || attrs['android:layout_gravity'];
  if (gravity) {
    if (gravity.includes('center')) {
      className.push('items-center justify-center');
    }
    if (gravity.includes('center_vertical')) className.push('items-center');
    if (gravity.includes('center_horizontal')) className.push('justify-center');
    if (gravity.includes('right') || gravity.includes('end')) className.push('justify-end items-end');
  }
  
  // Default flex behavior if layout_weight is used (simplified)
  if (attrs['android:layout_weight']) {
     style.flexGrow = Number(attrs['android:layout_weight']);
  }

  return { style, className: className.join(' ') };
};

export const XmlRenderer: React.FC<RendererProps> = ({ 
  node, 
  inputValues, 
  onInputChange, 
  onElementClick 
}) => {
  const { style, className } = getStyleFromAttributes(node.attributes);
  const text = node.attributes['android:text'] || node.text || '';
  const hint = node.attributes['android:hint'] || '';
  const src = node.attributes['android:src'];
  const idRaw = node.attributes['android:id'];
  const id = idRaw ? idRaw.replace('@+id/', '').replace('@id/', '') : undefined;

  // Common render children helper
  const renderChildren = () => (
    <>
      {node.children.map((child, index) => (
        <XmlRenderer 
          key={index} 
          node={child} 
          inputValues={inputValues}
          onInputChange={onInputChange}
          onElementClick={onElementClick}
        />
      ))}
    </>
  );

  const handleClick = (e: React.MouseEvent) => {
    if (id && onElementClick) {
      // e.stopPropagation(); // Maybe we want propagation?
      onElementClick(id);
    }
  };

  switch (node.tagName) {
    case 'LinearLayout':
      return (
        <div className={`flex ${className}`} style={style} onClick={handleClick}>
          {renderChildren()}
        </div>
      );

    case 'FrameLayout':
      return (
        <div className={`relative ${className}`} style={style} onClick={handleClick}>
          {renderChildren()}
        </div>
      );

    case 'TextView':
      return (
        <div className={`${className}`} style={style} onClick={handleClick}>
          {text}
        </div>
      );

    case 'Button':
      return (
        <button 
          className={`flex items-center justify-center rounded shadow-sm hover:opacity-90 active:scale-95 transition-transform ${className}`} 
          style={style}
          onClick={handleClick}
        >
          {text}
        </button>
      );

    case 'EditText':
      // eslint-disable-next-line no-case-declarations
      const currentVal = (id && inputValues) ? inputValues[id] : undefined;
      return (
        <input
          type="text"
          placeholder={hint}
          className={`border rounded px-2 outline-none focus:ring-2 focus:ring-blue-400 ${className}`}
          style={style}
          value={currentVal !== undefined ? currentVal : text}
          onChange={(e) => id && onInputChange && onInputChange(id, e.target.value)}
          onClick={handleClick}
        />
      );

    case 'ImageView':
      // Fallback if no src
      // eslint-disable-next-line @next/next/no-img-element
      return (
        <img
          src={src || 'https://picsum.photos/200/200'}
          alt="Xml Element"
          className={`object-cover ${className}`}
          style={style}
          onClick={handleClick}
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.onerror = null; // Prevent infinite loop
            // Only switch to placeholder if not already there to avoid loop
            if (target.src !== 'https://via.placeholder.com/150?text=Image+Error') {
                 target.src = 'https://via.placeholder.com/150?text=Image+Error';
            }
          }}
        />
      );
      
    case 'View':
      return <div className={className} style={style} onClick={handleClick} />;

    default:
      // Fallback for unknown tags - try to render them as container divs
      return (
        <div className={className} style={{...style, border: '1px dashed #ccc'}} onClick={handleClick}>
           {renderChildren()}
        </div>
      );
  }
};
