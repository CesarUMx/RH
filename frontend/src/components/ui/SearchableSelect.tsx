import { useState, useRef, useEffect } from 'react'
import { FaSearch, FaTimes } from 'react-icons/fa'

interface Option {
  value: number
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  options: Option[]
  value: number | null
  onChange: (value: number | null) => void
  placeholder?: string
  label?: string
  error?: string
}

export const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  label,
  error,
}: SearchableSelectProps) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value) ?? null

  const filtered = query.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(query.toLowerCase()) ||
          o.sublabel?.toLowerCase().includes(query.toLowerCase())
      )
    : options

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (opt: Option) => {
    onChange(opt.value)
    setOpen(false)
    setQuery('')
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}

      {/* Trigger */}
      <div
        className={`flex items-center w-full px-3 py-2 bg-white border rounded-md shadow-sm cursor-pointer text-sm ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${open ? 'ring-1 ring-primary border-primary' : 'hover:border-gray-400'}`}
        onClick={() => { setOpen(true) }}
      >
        {selected && !open ? (
          <span className="flex-1 truncate text-gray-900">{selected.label}</span>
        ) : (
          <span className={`flex-1 truncate ${open ? 'text-gray-400' : 'text-gray-400'}`}>
            {open ? '' : placeholder}
          </span>
        )}
        {selected && (
          <button type="button" onClick={handleClear} className="ml-1 text-gray-400 hover:text-gray-600">
            <FaTimes className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
          {/* Input de búsqueda */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <FaSearch className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              className="flex-1 text-sm outline-none placeholder-gray-400"
              placeholder="Escribir para buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Opciones */}
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">Sin resultados</li>
            ) : (
              filtered.map((opt) => (
                <li
                  key={opt.value}
                  className={`px-3 py-2 cursor-pointer hover:bg-primary/10 text-sm ${
                    opt.value === value ? 'bg-primary/5 font-medium text-primary' : 'text-gray-800'
                  }`}
                  onMouseDown={() => handleSelect(opt)}
                >
                  <span>{opt.label}</span>
                  {opt.sublabel && (
                    <span className="block text-xs text-gray-400">{opt.sublabel}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
