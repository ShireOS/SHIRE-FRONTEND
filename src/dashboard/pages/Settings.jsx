import { useState } from 'react'
import { Card, CardContent } from '../components/shared/Card'
import { Button } from '../components/shared/Button'
import { Badge } from '../components/shared/Badge'
import { Building2, Clock, Users, MapPin, Phone, Mail, Globe, Edit2, Plus, Shield, UserCog, ChefHat, User, Armchair } from 'lucide-react'
import { restaurantProfile, users, roles } from '../data/mockData'

const tabs = [
  { id: 'profile', label: 'Restaurant Profile', icon: Building2 },
  { id: 'users', label: 'Users & Permissions', icon: Users }
]

const roleColors = {
  owner: 'bg-dash-gold/20 text-dash-gold',
  manager: 'bg-blue-500/20 text-blue-400',
  server: 'bg-dash-success/20 text-dash-success',
  host: 'bg-dash-warning/20 text-dash-warning',
  kitchen: 'bg-dash-danger/20 text-dash-danger'
}

const roleIcons = {
  owner: Shield,
  manager: UserCog,
  server: User,
  host: Armchair,
  kitchen: ChefHat
}

export function Settings() {
  const [activeTab, setActiveTab] = useState('profile')

  const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dash-cream">
          <span className="font-dash-display italic text-dash-gold">Settings</span>
        </h1>
        <p className="text-dash-secondary mt-1">Manage your restaurant profile and team</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-dash-border">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-dash-gold text-dash-gold'
                  : 'border-transparent text-dash-secondary hover:text-dash-cream'
              }`}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Restaurant Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-dash-cream">Basic Information</h3>
                <Button variant="ghost" size="sm" icon={<Edit2 size={14} />}>Edit</Button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-dash-gold/20 border border-dash-gold/30 rounded-xl flex items-center justify-center text-dash-gold text-2xl font-bold">
                    GF
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold text-dash-cream">{restaurantProfile.name}</h4>
                    <p className="text-dash-tertiary">Fine Dining Restaurant</p>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <MapPin size={18} className="text-dash-tertiary" />
                    <span className="text-dash-secondary">{restaurantProfile.address}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={18} className="text-dash-tertiary" />
                    <span className="text-dash-secondary">{restaurantProfile.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail size={18} className="text-dash-tertiary" />
                    <span className="text-dash-secondary">{restaurantProfile.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe size={18} className="text-dash-tertiary" />
                    <span className="text-dash-gold">{restaurantProfile.website}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hours */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-dash-tertiary" />
                  <h3 className="font-semibold text-dash-cream">Operating Hours</h3>
                </div>
                <Button variant="ghost" size="sm" icon={<Edit2 size={14} />}>Edit</Button>
              </div>

              <div className="space-y-3">
                {daysOfWeek.map((day) => {
                  const hours = restaurantProfile.hours[day]
                  const isWeekend = day === 'saturday' || day === 'sunday'
                  return (
                    <div key={day} className="flex items-center justify-between py-2 border-b border-dash-border last:border-0">
                      <span className={`capitalize ${isWeekend ? 'font-medium text-dash-cream' : 'text-dash-secondary'}`}>
                        {day}
                      </span>
                      <span className="text-dash-secondary">
                        {hours.open} - {hours.close}
                      </span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Capacity */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-dash-cream">Capacity</h3>
                <Button variant="ghost" size="sm" icon={<Edit2 size={14} />}>Edit</Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-dash-cream/5 rounded-xl text-center border border-dash-border">
                  <p className="text-3xl font-bold text-dash-cream">{restaurantProfile.capacity.totalSeats}</p>
                  <p className="text-sm text-dash-tertiary">Total Seats</p>
                </div>
                <div className="p-4 bg-dash-cream/5 rounded-xl text-center border border-dash-border">
                  <p className="text-3xl font-bold text-dash-cream">{restaurantProfile.capacity.tables}</p>
                  <p className="text-sm text-dash-tertiary">Tables</p>
                </div>
                <div className="p-4 bg-dash-cream/5 rounded-xl text-center border border-dash-border">
                  <p className="text-3xl font-bold text-dash-cream">{restaurantProfile.capacity.barSeats}</p>
                  <p className="text-sm text-dash-tertiary">Bar Seats</p>
                </div>
                <div className="p-4 bg-dash-cream/5 rounded-xl text-center border border-dash-border">
                  <p className="text-3xl font-bold text-dash-cream">{restaurantProfile.capacity.patioSeats}</p>
                  <p className="text-sm text-dash-tertiary">Patio Seats</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table Layout */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-dash-cream">Table Layout</h3>
                <Button variant="ghost" size="sm" icon={<Edit2 size={14} />}>Manage</Button>
              </div>

              <div className="space-y-2">
                {['main', 'window', 'patio', 'private'].map((section) => {
                  const sectionTables = restaurantProfile.tableLayout.filter(t => t.section === section)
                  if (sectionTables.length === 0) return null
                  return (
                    <div key={section} className="flex items-center justify-between py-2 border-b border-dash-border">
                      <span className="capitalize text-dash-secondary">{section} Section</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-dash-tertiary">
                          {sectionTables.length} tables
                        </span>
                        <span className="text-sm text-dash-tertiary">·</span>
                        <span className="text-sm text-dash-tertiary">
                          {sectionTables.reduce((sum, t) => sum + t.seats, 0)} seats
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <Button variant="outline" className="w-full mt-4" size="sm">
                View Floor Plan
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Users & Permissions Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* User Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-dash-cream">{users.length}</p>
                <p className="text-sm text-dash-tertiary">Total Users</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-dash-success">{users.filter(u => u.status === 'active').length}</p>
                <p className="text-sm text-dash-tertiary">Active</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-dash-tertiary">{users.filter(u => u.status === 'inactive').length}</p>
                <p className="text-sm text-dash-tertiary">Inactive</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-center">
                <Button icon={<Plus size={18} />}>Add User</Button>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-dash-cream mb-4">Team Members</h3>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dash-border">
                      <th className="pb-3 label-mono text-left">USER</th>
                      <th className="pb-3 label-mono text-left">ROLE</th>
                      <th className="pb-3 label-mono text-left">STATUS</th>
                      <th className="pb-3 label-mono text-left">LAST LOGIN</th>
                      <th className="pb-3 label-mono text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dash-border">
                    {users.map((user) => {
                      const RoleIcon = roleIcons[user.role]
                      return (
                        <tr key={user.id} className="hover:bg-dash-cream/5 transition-colors">
                          <td className="py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-dash-cream/10 border border-dash-border rounded-full flex items-center justify-center text-dash-cream font-medium">
                                {user.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <p className="font-medium text-dash-cream">{user.name}</p>
                                <p className="text-sm text-dash-tertiary">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                              <RoleIcon size={12} />
                              {roles[user.role].label}
                            </div>
                          </td>
                          <td className="py-4">
                            <Badge variant={user.status === 'active' ? 'success' : 'default'}>
                              {user.status}
                            </Badge>
                          </td>
                          <td className="py-4 text-sm text-dash-tertiary">
                            {user.lastLogin}
                          </td>
                          <td className="py-4 text-right">
                            <Button variant="ghost" size="sm">Edit</Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Roles & Permissions */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-dash-cream mb-4">Roles & Permissions</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(roles).map(([roleId, role]) => {
                  const RoleIcon = roleIcons[roleId]
                  const userCount = users.filter(u => u.role === roleId).length
                  return (
                    <div key={roleId} className="p-4 border border-dash-border rounded-xl hover:border-dash-gold/30 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${roleColors[roleId]}`}>
                          <RoleIcon size={14} />
                          <span className="font-medium">{role.label}</span>
                        </div>
                        <span className="text-sm text-dash-tertiary">{userCount} users</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {role.permissions.map((perm) => (
                          <span key={perm} className="px-2 py-0.5 bg-dash-cream/10 text-dash-secondary text-xs rounded">
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
