export const CASHIER_COLLECTOR_ASSIGNMENTS = [
  { value: 'flora', label: 'Flora My Ferrer', aliases: ['flora my ferrer', 'flora my d ferrer', 'flora my d. ferrer', 'flora my', 'flora'] },
  { value: 'agnes', label: 'Agnes Ello', aliases: ['agnes ello', 'agnes b ello', 'agnes b. ello', 'agnes'] },
  { value: 'ricardo', label: 'Ricardo Enopia', aliases: ['ricardo enopia', 'ricardo t enopia', 'ricardo t. enopia', 'ricardo'] },
  { value: 'emily', label: 'Emily Credo', aliases: ['emily credo', 'emily e credo', 'emily e. credo', 'emily'] },
  { value: 'angelique', label: 'Angelique Iris Rafales', aliases: ['angelique iris rafales', 'angelique iris a rafales', 'angelique iris a. rafales', 'angelique', 'iris'] },
  { value: 'amabella', label: 'Amabella S. Ramos', aliases: ['amabella s ramos', 'amabella s. ramos', 'amabella', 'collector account', 'collector'] },
  { value: 'gtz', label: 'GTZ', aliases: ['gtz'] },
]

const normalizeAssignmentName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')

export const getCashierCollectorAssignment = (user) => {
  if (user?.role !== 'cashier') return null

  const userName = normalizeAssignmentName(user.name)

  return CASHIER_COLLECTOR_ASSIGNMENTS.find((assignment) => {
    const aliases = [assignment.label, assignment.value, ...(assignment.aliases || [])]
    return aliases.some((alias) => normalizeAssignmentName(alias) === userName)
  }) || null
}

export const isCashierAssignmentName = (name) => {
  const normalized = normalizeAssignmentName(name)

  return CASHIER_COLLECTOR_ASSIGNMENTS.some((assignment) => {
    const aliases = [assignment.label, ...(assignment.aliases || [])]
    return aliases.some((alias) => normalizeAssignmentName(alias) === normalized)
  })
}

export const getCashierAssignmentByName = (name) => {
  const normalized = normalizeAssignmentName(name)

  return CASHIER_COLLECTOR_ASSIGNMENTS.find((assignment) => {
    const aliases = [assignment.label, assignment.value, ...(assignment.aliases || [])]
    return aliases.some((alias) => normalizeAssignmentName(alias) === normalized)
  }) || null
}

