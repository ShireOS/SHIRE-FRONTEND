import { Card, CardContent } from '../shared/Card'
import { Star, Beef, PuzzleIcon, Dog } from 'lucide-react'
import { menuItems } from '../../data/mockData'

const categoryConfig = {
  star: { label: 'Stars', icon: Star, color: 'text-amber-500', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', desc: 'High popularity, high profit' },
  cow: { label: 'Cash Cows', icon: Beef, color: 'text-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200', desc: 'High popularity, lower profit' },
  puzzle: { label: 'Puzzles', icon: PuzzleIcon, color: 'text-purple-500', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', desc: 'Low popularity, high profit' },
  dog: { label: 'Dogs', icon: Dog, color: 'text-gray-500', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', desc: 'Consider removing' }
}

export function MenuMatrix() {
  const categories = {
    star: menuItems.filter(i => i.category === 'star'),
    cow: menuItems.filter(i => i.category === 'cow'),
    puzzle: menuItems.filter(i => i.category === 'puzzle'),
    dog: menuItems.filter(i => i.category === 'dog')
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Menu Engineering Matrix</h3>

        <div className="grid grid-cols-2 gap-4">
          {/* High Popularity Row */}
          <div className={`p-4 rounded-xl border ${categoryConfig.cow.borderColor} ${categoryConfig.cow.bgColor}`}>
            <div className="flex items-center gap-2 mb-3">
              <Beef size={18} className={categoryConfig.cow.color} />
              <span className="font-semibold text-gray-900">{categoryConfig.cow.label}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">{categoryConfig.cow.desc}</p>
            <div className="space-y-2">
              {categories.cow.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="text-gray-500">${item.margin} margin</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`p-4 rounded-xl border ${categoryConfig.star.borderColor} ${categoryConfig.star.bgColor}`}>
            <div className="flex items-center gap-2 mb-3">
              <Star size={18} className={categoryConfig.star.color} />
              <span className="font-semibold text-gray-900">{categoryConfig.star.label}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">{categoryConfig.star.desc}</p>
            <div className="space-y-2">
              {categories.star.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="text-gray-500">${item.margin} margin</span>
                </div>
              ))}
            </div>
          </div>

          {/* Low Popularity Row */}
          <div className={`p-4 rounded-xl border ${categoryConfig.dog.borderColor} ${categoryConfig.dog.bgColor}`}>
            <div className="flex items-center gap-2 mb-3">
              <Dog size={18} className={categoryConfig.dog.color} />
              <span className="font-semibold text-gray-900">{categoryConfig.dog.label}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">{categoryConfig.dog.desc}</p>
            <div className="space-y-2">
              {categories.dog.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="text-red-500">→ Remove?</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`p-4 rounded-xl border ${categoryConfig.puzzle.borderColor} ${categoryConfig.puzzle.bgColor}`}>
            <div className="flex items-center gap-2 mb-3">
              <PuzzleIcon size={18} className={categoryConfig.puzzle.color} />
              <span className="font-semibold text-gray-900">{categoryConfig.puzzle.label}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">{categoryConfig.puzzle.desc}</p>
            <div className="space-y-2">
              {categories.puzzle.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="text-purple-600">→ Upsell</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Axis Labels */}
        <div className="mt-4 flex justify-between text-xs text-gray-400">
          <span>← Low Profit</span>
          <span>High Profit →</span>
        </div>
      </CardContent>
    </Card>
  )
}
