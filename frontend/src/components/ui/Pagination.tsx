import React from 'react';
import ReactPaginate from 'react-paginate';
import { Button } from './Button';

interface PaginationProps {
  currentPage: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  pageCount,
  onPageChange,
  totalItems,
  pageSize = 10,
}) => {
  // Asegurar que los valores sean números válidos
  const validCurrentPage = Number.isInteger(currentPage) && currentPage > 0 ? currentPage : 1;
  const validPageCount = Number.isInteger(pageCount) && pageCount > 0 ? pageCount : 1;
  
  // Calcular el rango de elementos mostrados
  const startItem = (validCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(validCurrentPage * pageSize, totalItems || validPageCount * pageSize);
  
  return (
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-4">
      {totalItems !== undefined && (
        <div className="text-sm text-gray-700">
          Mostrando {startItem} a {endItem} de {totalItems} registros
        </div>
      )}
      
      <ReactPaginate
        previousLabel={<Button variant="outline" size="sm">Anterior</Button>}
        nextLabel={<Button variant="outline" size="sm">Siguiente</Button>}
        breakLabel="..."
        pageCount={validPageCount}
        marginPagesDisplayed={2}
        pageRangeDisplayed={3}
        onPageChange={(data) => onPageChange(data.selected + 1)}
        containerClassName="flex items-center gap-2"
        pageClassName="hidden md:block"
        pageLinkClassName="px-3 py-1 border rounded hover:bg-gray-100 text-gray-700"
        activeLinkClassName="bg-primary text-white hover:bg-primary-dark"
        breakClassName="px-3 py-1 text-gray-500"
        disabledClassName="opacity-50 cursor-not-allowed"
        forcePage={validCurrentPage - 1}
      />
    </div>
  );
};
