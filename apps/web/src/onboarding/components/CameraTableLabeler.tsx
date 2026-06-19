import { useState } from 'react'

interface TableDetection {
  id: string
  x: number
  y: number
  width: number
  height: number
  tableNumber: string
  capacity: number
  section: string
  confidence: number
}

interface CameraTableLabelerProps {
  onBack: () => void
  onSave: (tables: TableDetection[]) => void
}

// Mock "detected" tables - simulating CV output
const MOCK_DETECTIONS: Omit<TableDetection, 'tableNumber' | 'capacity' | 'section'>[] = [
  { id: '1', x: 15, y: 20, width: 12, height: 10, confidence: 94 },
  { id: '2', x: 35, y: 20, width: 12, height: 10, confidence: 91 },
  { id: '3', x: 55, y: 20, width: 12, height: 10, confidence: 88 },
  { id: '4', x: 75, y: 20, width: 12, height: 10, confidence: 96 },
  { id: '5', x: 15, y: 45, width: 15, height: 12, confidence: 92 },
  { id: '6', x: 40, y: 45, width: 15, height: 12, confidence: 89 },
  { id: '7', x: 65, y: 45, width: 15, height: 12, confidence: 95 },
  { id: '8', x: 20, y: 70, width: 18, height: 14, confidence: 87 },
  { id: '9', x: 50, y: 70, width: 18, height: 14, confidence: 93 },
]

export function CameraTableLabeler({ onBack, onSave }: CameraTableLabelerProps) {
  const [tables, setTables] = useState<TableDetection[]>(
    MOCK_DETECTIONS.map((d, i) => ({
      ...d,
      tableNumber: (i + 1).toString(),
      capacity: i < 4 ? 2 : i < 7 ? 4 : 6,
      section: 'Main Floor',
    }))
  )
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [editingTable, setEditingTable] = useState<TableDetection | null>(null)

  const handleTableClick = (tableId: string) => {
    setSelectedTable(tableId)
    const table = tables.find(t => t.id === tableId)
    if (table) {
      setEditingTable({ ...table })
    }
  }

  const handleSaveEdit = () => {
    if (editingTable) {
      setTables(prev => prev.map(t => t.id === editingTable.id ? editingTable : t))
      setEditingTable(null)
      setSelectedTable(null)
    }
  }

  const handleDeleteTable = (tableId: string) => {
    setTables(prev => prev.filter(t => t.id !== tableId))
    setEditingTable(null)
    setSelectedTable(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <button
          onClick={() => onSave(tables)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          Save {tables.length} Tables
        </button>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-blue-200 text-sm">
              Click on each detected table to assign a number and capacity.
              Our AI has detected <span className="font-semibold">{tables.length} tables</span> in your floor plan.
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Camera View */}
        <div className="flex-1">
          <div
            className="relative bg-gray-800 rounded-lg overflow-hidden"
            style={{ paddingBottom: '75%' }}
          >
            {/* Mock camera feed background */}
            <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800">
              {/* Floor pattern */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, gray 1px, transparent 1px),
                    linear-gradient(to bottom, gray 1px, transparent 1px)
                  `,
                  backgroundSize: '40px 40px',
                }}
              />

              {/* Mock elements */}
              <div className="absolute top-2 left-2 text-xs text-gray-500 font-mono">
                LIVE FEED - CAMERA 01
              </div>
              <div className="absolute top-2 right-2 flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-gray-500">REC</span>
              </div>
            </div>

            {/* Table detections */}
            {tables.map((table) => (
              <button
                key={table.id}
                onClick={() => handleTableClick(table.id)}
                className={`absolute border-2 rounded transition-all ${
                  selectedTable === table.id
                    ? 'border-blue-500 bg-blue-500/30'
                    : 'border-green-500 bg-green-500/20 hover:bg-green-500/30'
                }`}
                style={{
                  left: `${table.x}%`,
                  top: `${table.y}%`,
                  width: `${table.width}%`,
                  height: `${table.height}%`,
                }}
              >
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-gray-900 rounded text-white text-xs font-mono whitespace-nowrap">
                  T{table.tableNumber}
                </div>
                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-green-500/80 rounded text-white text-[10px] font-mono">
                  {table.confidence}%
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Edit Panel */}
        <div className="w-64">
          {editingTable ? (
            <div className="p-4 bg-gray-800 rounded-lg space-y-4">
              <h3 className="text-white font-medium">Edit Table</h3>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Table Number</label>
                <input
                  type="text"
                  value={editingTable.tableNumber}
                  onChange={(e) => setEditingTable({ ...editingTable, tableNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Capacity</label>
                <select
                  value={editingTable.capacity}
                  onChange={(e) => setEditingTable({ ...editingTable, capacity: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[2, 4, 6, 8, 10, 12].map(n => (
                    <option key={n} value={n}>{n} seats</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Section</label>
                <select
                  value={editingTable.section}
                  onChange={(e) => setEditingTable({ ...editingTable, section: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Main Floor">Main Floor</option>
                  <option value="Bar">Bar</option>
                  <option value="Patio">Patio</option>
                  <option value="Private">Private</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => handleDeleteTable(editingTable.id)}
                  className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors text-sm"
                >
                  Delete
                </button>
              </div>

              <div className="pt-2 text-xs text-gray-500">
                Detection confidence: {editingTable.confidence}%
              </div>
            </div>
          ) : (
            <div className="p-4 bg-gray-800 rounded-lg text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-gray-700 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <p className="text-gray-400 text-sm">
                Click on a table to edit its details
              </p>
            </div>
          )}

          {/* Table list */}
          <div className="mt-4 p-4 bg-gray-800 rounded-lg">
            <h4 className="text-sm text-gray-400 mb-2">All Tables ({tables.length})</h4>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {tables.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTableClick(t.id)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                    selectedTable === t.id
                      ? 'bg-blue-500/20 text-white'
                      : 'text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  <span>Table {t.tableNumber}</span>
                  <span className="text-xs">{t.capacity} seats</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
