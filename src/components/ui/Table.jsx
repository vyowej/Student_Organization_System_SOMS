import { useEffect, useRef } from 'react'
import DataTable from 'datatables.net-dt'
import 'datatables.net-dt/css/dataTables.dataTables.min.css'

export default function Table(props) {
  const { rows, getRowKey = (row, index) => row.id ?? index } = props
  const tableKey = rows.length + '-' + rows.map((r, i) => getRowKey(r, i)).join('-').slice(0, 100)
  return <TableInner key={tableKey} {...props} />
}

function TableInner({ columns, rows, getRowKey = (row, index) => row.id ?? index, useDataTable = false }) {
  const tableRef = useRef(null)

  useEffect(() => {
    if (useDataTable && tableRef.current) {
      const dt = new DataTable(tableRef.current, {
        destroy: true,
        paging: true,
        searching: false,
        ordering: true,
        info: true,
        layout: {
          topStart: null,
          topEnd: null,
          bottomStart: ['pageLength', 'info'],
          bottomEnd: 'paging'
        },
        columnDefs: columns.map((col, idx) => ({
          targets: idx,
          orderable: col.key !== 'actions'
        })),
      })
      return () => {
        dt.destroy()
      }
    }
  }, [useDataTable, rows, columns])

  return (
    <div className={`data-table-wrap ${useDataTable ? 'using-datatables' : ''}`}>
      <table className="data-table" ref={tableRef}>
        <thead>
          <tr>
            {columns.map((column) => <th key={column.key}>{column.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={getRowKey(row, rowIndex)}>
              {columns.map((column) => (
                <td
                  className={column.nowrap || ['id', 'userId', 'studentId'].includes(column.key) ? 'cell-nowrap' : undefined}
                  data-label={column.label}
                  key={column.key}
                >
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
