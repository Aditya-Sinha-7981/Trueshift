export default function EmployeeCard({ employee, onRowClick }) {
  const shift =
    employee.shift_start && employee.shift_end
      ? `${employee.shift_start}–${employee.shift_end}`
      : "—"
  const status =
    employee.is_verified === false ? "pending" : employee.is_active === false ? "inactive" : "active"

  return (
    <tr
      className="cursor-pointer border-b border-slate-800 hover:bg-slate-800/40"
      onClick={() => onRowClick?.(employee)}
    >
      <td className="py-3 pr-2">{employee.full_name}</td>
      <td className="py-3 pr-2 font-mono text-xs">{employee.employee_id || "—"}</td>
      <td className="py-3 pr-2">{employee.department || "—"}</td>
      <td className="hidden py-3 pr-2 sm:table-cell">{employee.designation || "—"}</td>
      <td className="hidden py-3 pr-2 md:table-cell">{shift}</td>
      <td className="py-3">
        <span
          className={`rounded-full px-2 py-0.5 text-xs capitalize ${
            status === "active"
              ? "bg-emerald-950 text-emerald-200"
              : status === "pending"
                ? "bg-amber-950 text-amber-200"
                : "bg-slate-800 text-slate-300"
          }`}
        >
          {status}
        </span>
      </td>
    </tr>
  )
}
