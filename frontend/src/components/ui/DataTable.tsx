import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  type SortingState,
} from '@tanstack/react-table';
import { useState, useMemo } from 'react';
import { Pagination } from './Pagination';

interface DataTableProps<TData> {
  columns: any[];
  data: TData[];
  disablePagination?: boolean;
}

export function DataTable<TData>({ columns, data, disablePagination = false }: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Reset a página 1 cuando cambia el tamaño de página
  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const pageCount = Math.max(1, Math.ceil(data.length / pageSize));

  const pagedData = useMemo(() => {
    if (disablePagination) return data;
    const start = (currentPage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, currentPage, pageSize, disablePagination]);

  const table = useReactTable({
    data: pagedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: (updater) => {
      setSorting(updater);
      setCurrentPage(1);
    },
    state: { sorting },
  });

  return (
    <div className="w-full">
      {!disablePagination && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-gray-700">Mostrar</span>
          <select
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded-md text-sm px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-sm text-gray-700">registros</span>
        </div>
      )}

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
                        className={header.column.getCanSort() ? 'cursor-pointer select-none' : ''}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: ' ▲', desc: ' ▼' }[header.column.getIsSorted() as string] ?? null}
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
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-gray-500">
                  No hay datos disponibles
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!disablePagination && (
        <Pagination
          currentPage={currentPage}
          pageCount={pageCount}
          totalItems={data.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
