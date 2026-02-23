import { useState, useEffect, useRef } from 'react';
import 'mathlive';

type MathfieldElement = HTMLElement & { 
  value: string; 
  getValue: (format: string) => string; 
};

function App() {
  const [latex, setLatex] = useState<string>("");
  
  const [pythonFormula, setPythonFormula] = useState<string>("");
  
  const mf = useRef<MathfieldElement>(null);

  useEffect(() => {
    const field = mf.current;
    if (field) {
      const handleInput = (e: Event) => {
        const target = e.target as MathfieldElement;
        
        setLatex(target.value);
        let ascii = target.getValue('ascii-math');
        
        const cleanedPython = ascii.replace(/\^/g, '**');
        
        setPythonFormula(cleanedPython);
      };

      field.addEventListener('input', handleInput);
      return () => field.removeEventListener('input', handleInput);
    }
  }, []);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      padding: '40px',
      fontFamily: 'system-ui, sans-serif' 
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '600px', 
        border: '1px solid #3498db', 
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <math-field 
          ref={mf} 
          style={{ 
            width: '100%', 
            padding: '15px', 
            fontSize: '1.5rem',
            outline: 'none'
          }}
        >
          {latex}
        </math-field>
      </div>
      {pythonFormula}
    </div>
  );
}

export default App;