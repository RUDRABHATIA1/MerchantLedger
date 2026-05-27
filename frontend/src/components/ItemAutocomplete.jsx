import { useState, useEffect, useRef } from 'react';
import api from '../api/client';

function LevenshteinDistance(a, b) {
  const tmp = [];
  let i, j;
  const alen = a.length;
  const blen = b.length;
  if (alen === 0) return blen;
  if (blen === 0) return alen;
  for (i = 0; i <= alen; i++) tmp[i] = [i];
  for (j = 0; j <= blen; j++) tmp[0][j] = j;
  for (i = 1; i <= alen; i++) {
    for (j = 1; j <= blen; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[alen][blen];
}

export default function ItemAutocomplete({ value, onChange, placeholder = 'Item Name', className = '', required = false }) {
  const [items, setItems] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);

  // Fetch unique items on mount
  useEffect(() => {
    let active = true;
    const fetchItems = async () => {
      try {
        const res = await api.get('/items/autocomplete');
        if (active && res.data?.success) {
          setItems(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load item names for autocomplete', err);
      }
    };
    fetchItems();
    return () => { active = false; };
  }, []);

  // Filter items based on user input
  useEffect(() => {
    if (!value || value.trim() === '') {
      setSuggestions([]);
      return;
    }

    const val = value.toLowerCase().trim();
    
    // 1. Substring/Exact Match
    const substringMatches = items.filter(item => 
      item.toLowerCase().includes(val)
    );

    // 2. Fuzzy Match (edit distance <= 2)
    const fuzzyMatches = items.filter(item => {
      const itemLower = item.toLowerCase();
      // Avoid duplicate with substring matches
      if (itemLower.includes(val)) return false;
      
      // Calculate Levenshtein distance on words or whole string
      const dist = LevenshteinDistance(itemLower, val);
      if (dist <= 2) return true;

      // Also check word-by-word distance for multi-word item names
      const words = itemLower.split(/\s+/);
      return words.some(w => LevenshteinDistance(w, val) <= 1);
    });

    // Merge and limit
    const merged = [...substringMatches, ...fuzzyMatches].slice(0, 8);
    setSuggestions(merged);
  }, [value, items]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item) => {
    onChange(item);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      if (isOpen && activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        required={required}
        className={className}
      />
      
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-bg-card border border-border-light rounded-lg shadow-xl z-[999] py-1">
          {suggestions.map((item, idx) => {
            const isFuzzy = !item.toLowerCase().includes((value || '').toLowerCase().trim());
            const isActive = idx === activeIndex;

            return (
              <li
                key={item}
                onClick={() => handleSelect(item)}
                className={`px-3 py-2 text-xs cursor-pointer flex justify-between items-center transition-colors ${
                  isActive ? 'bg-blue-primary/20 text-blue-light' : 'text-text-primary hover:bg-bg-surface'
                }`}
              >
                <span>{item}</span>
                {isFuzzy && (
                  <span className="text-[0.62rem] px-1.5 py-0.5 rounded bg-blue-primary/10 text-blue-light/80 border border-blue-primary/20">
                    Fuzzy Match
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
