import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { CountryProfile } from "../../types";

interface SearchableComboboxProps {
  label?: string;
  value: string | null;
  onChange: (value: string) => void;
  profiles: CountryProfile[];
  placeholder?: string;
  disabled?: boolean;
}

const getFlagEmoji = (countryName: string) => {
  // Simple heuristic for flag emoji mapping (or we just use a generic emoji if mapping requires huge dictionary)
  // For the sake of UI, we will just show 🌐 or try generic map. In a real app we'd map ISO codes.
  // Actually, we can return 📍
  return "📍";
};

export const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  label,
  value,
  onChange,
  profiles,
  placeholder = "Select country...",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredData =
    query === ""
      ? profiles.slice(0, 20)
      : profiles
          .filter((p) =>
            p.country.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 20);

  return (
    <div
      className="relative flex flex-col gap-1 w-full"
      ref={containerRef}
    >
      {label && (
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">
          {label}
        </label>
      )}
      <div
        className={`relative w-full rounded-xl border transition-all duration-300 ${
          isOpen
            ? "border-indigo-500 bg-white/10 ring-2 ring-indigo-500/20"
            : "border-white/10 bg-white/5 hover:border-white/20"
        } ${disabled ? "opacity-50 pointer-events-none" : ""}`}
      >
        <div className="flex items-center px-3 py-2">
          {isOpen ? (
            <Search size={14} className="text-indigo-400 mr-2 shrink-0" />
          ) : (
            <span className="mr-2 text-sm">{getFlagEmoji(value || "")}</span>
          )}
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent border-none outline-none text-sm text-white placeholder:text-slate-500 font-medium"
            placeholder={value && !isOpen ? value : placeholder}
            value={isOpen ? query : value || ""}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onClick={() => setIsOpen(true)}
            readOnly={!isOpen}
          />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1 hover:bg-white/10 rounded-md transition-colors"
          >
            <ChevronDown
              size={14}
              className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-[100%] left-0 right-0 mt-2 max-h-[220px] overflow-y-auto bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 p-1 custom-scrollbar">
          {filteredData.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 text-center">
              No matching nodes found
            </div>
          ) : (
            filteredData.map((item) => (
              <button
                key={item.country}
                onClick={() => {
                  onChange(item.country);
                  setQuery("");
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  value === item.country
                    ? "bg-indigo-500/20 text-indigo-300 font-bold"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{getFlagEmoji(item.country)}</span>
                  <span>{item.country}</span>
                </div>
                {value === item.country && <Check size={14} className="text-indigo-400" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};
