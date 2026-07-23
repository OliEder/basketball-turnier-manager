import TeamList from '@/components/teams/TeamList'

export default function TeamsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl text-brand-primary">Teams</h1>
      <TeamList />
    </div>
  )
}
