import EmptyState from './EmptyState';
import Spinner from './Spinner';
import { cn } from '../../utils/cn';

export default function DataTable({
  columns,
  rows,
  loading,
  emptyTitle,
  emptyDescription,
  rowKey = 'id',
  className,
}) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-white', className)}>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-line">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-muted',
                    column.headerClassName
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-white">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center">
                  <Spinner className="justify-center" />
                </td>
              </tr>
            ) : rows.length ? (
              rows.map((row) => (
                <tr key={typeof rowKey === 'function' ? rowKey(row) : row[rowKey]} className="hover:bg-slate-50/80">
                  {columns.map((column) => (
                    <td key={column.key} className={cn('px-4 py-3 text-sm text-ink', column.className)}>
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="p-4">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
