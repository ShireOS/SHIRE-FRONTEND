import { ChevronRight } from 'lucide-react'
import { tables } from '../../data/mockData'

export function FloorStatus() {
  return (
    <div className="h-full p-6 rounded-2xl bg-white border border-gray-100 shadow-lg relative overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg text-gray-900">Floor Plan</h3>
        <button className="text-xs font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors uppercase tracking-wider bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 hover:border-gray-300">
          View Detail <ChevronRight size={14} />
        </button>
      </div>

      {/* Modern Table Grid */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {tables.map((table) => {
          const statusStyle =
            table.status === 'occupied' ? 'bg-gradient-to-br from-rose-100 to-rose-50 border-rose-200 shadow-rose-100/50' :
              table.status === 'needsAttention' ? 'bg-gradient-to-br from-amber-100 to-amber-50 border-amber-200 shadow-amber-100/50' :
                table.status === 'dirty' ? 'bg-gradient-to-br from-gray-100 to-gray-50 border-gray-300 border-dashed' :
                  'bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-emerald-100/50 hover:shadow-emerald-200/50';

          const dotColor =
            table.status === 'occupied' ? 'bg-rose-500' :
              table.status === 'needsAttention' ? 'bg-amber-500' :
                table.status === 'dirty' ? 'bg-gray-400' :
                  'bg-emerald-500';

          return (
            <div
              key={table.id}
              className={`
                aspect-square rounded-xl border-2 flex flex-col items-center justify-center
                font-medium cursor-pointer transition-all duration-300 shadow-sm hover:shadow-md hover:scale-[1.02]
                ${statusStyle}
              `}
              title={`Table ${table.id}`}
            >
              <span className="font-bold text-xl text-gray-800">{table.id}</span>
              <span className={`w-2 h-2 rounded-full ${dotColor} mt-1.5`}></span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-5 text-xs text-gray-500 font-medium pt-4 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span>Occupied</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>Needs Attn</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          <span>Dirty</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Open</span>
        </div>
      </div>
    </div>
  )
}
