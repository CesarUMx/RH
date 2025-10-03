import { useState } from 'react';
import { FaChevronDown, FaBuilding } from 'react-icons/fa';
import { useArea } from '../context/AreaContext';

export const AreaSelector = () => {
  const { areas, selectedArea, setSelectedArea, isLoading } = useArea();
  const [isOpen, setIsOpen] = useState(false);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handleSelectArea = (areaId: number) => {
    const area = areas.find(a => a.id === areaId);
    if (area) {
      setSelectedArea(area);
    }
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center px-3 py-2 text-sm text-white bg-primary-light rounded-md">
        <div className="animate-spin h-4 w-4 mr-2 border-t-2 border-b-2 border-white rounded-full"></div>
        <span>Cargando áreas...</span>
      </div>
    );
  }

  if (!selectedArea || areas.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-white bg-primary-light rounded-md">
        <span>Sin áreas asignadas</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="flex items-center justify-between w-full px-3 py-2 text-sm text-white bg-primary-light hover:bg-primary-dark rounded-md transition-colors duration-200"
      >
        <div className="flex items-center">
          <FaBuilding className="mr-2" />
          <span>{selectedArea.nombre}</span>
        </div>
        <FaChevronDown className={`ml-2 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg">
          <ul className="py-1 max-h-60 overflow-auto">
            {areas.map((area) => (
              <li key={area.id}>
                <button
                  onClick={() => handleSelectArea(area.id)}
                  className={`flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 ${
                    selectedArea.id === area.id ? 'bg-gray-100 font-medium' : ''
                  }`}
                >
                  {area.nombre}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
