// Importaciones de tipos
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { Button } from './Button';

// Definir el tipo para la paginación
type PaginationState = {
  pageIndex: number;
  pageSize: number;
};

interface DataTableProps<TData> {
  columns: any[];
  data: TData[];
  pagination?: {
    pageIndex: number;
    pageSize: number;
    pageCount: number;
    onPaginationChange?: (pagination: PaginationState) => void;
    serverSide?: boolean;
  };
}

export function DataTable<TData>({
  columns,
  data,
  pagination,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  // Configuración de la tabla con manejo especial para la paginación
  const tableConfig: any = {
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
      ...(pagination && {
        pagination: {
          pageIndex: pagination.pageIndex >= 0 ? pagination.pageIndex : 0,
          pageSize: pagination.pageSize > 0 ? pagination.pageSize : 10,
        },
      }),
    },
  };
  
  // Añadir configuración de paginación si está habilitada
  if (pagination) {
    tableConfig.getPaginationRowModel = pagination.serverSide ? undefined : getPaginationRowModel();
    tableConfig.manualPagination = pagination.serverSide;
    tableConfig.pageCount = pagination.pageCount > 0 ? pagination.pageCount : 1;
    
    // Usar any para evitar problemas de tipo con onPaginationChange
    if (pagination.onPaginationChange) {
      tableConfig.onPaginationChange = pagination.onPaginationChange;
    }
    
    // Agregar logs para depuración
    console.log('DataTable pagination config:', {
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      pageCount: pagination.pageCount,
      serverSide: pagination.serverSide
    });
  }
  
  const table = useReactTable(tableConfig);

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <table className="w-full table-auto">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={
                          header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: ' 🔼',
                          desc: ' 🔽',
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm text-gray-500">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  No hay datos disponibles
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between px-2 py-3 mt-2">
          <div className="flex-1 text-sm text-gray-700">
            {data.length > 0 ? (
              <>
                Mostrando {' '}
                {Math.min(table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1, data.length)} a{' '}
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                  pagination.serverSide ? (pagination.pageCount || 1) * pagination.pageSize : data.length
                )}{' '}
                de{' '}
                {pagination.serverSide && pagination.pageCount > 0 ? 
                  (pagination.pageCount * pagination.pageSize) : 
                  data.length} registros
              </>
            ) : (
              <>No hay registros para mostrar</>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Anterior
            </Button>
            <span className="text-sm text-gray-700">
              Página {table.getState().pagination.pageIndex + 1} de{' '}
              {pagination.pageCount || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
