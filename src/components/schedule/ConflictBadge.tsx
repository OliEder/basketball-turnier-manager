interface Props {
  message: string
}

export default function ConflictBadge({ message }: Props) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-sm text-xs font-semibold uppercase bg-err text-white">
      {message}
    </span>
  )
}
