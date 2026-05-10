export function detectPriorityFromIssue(issue = '') {
  const lower = issue.toLowerCase();
  if (lower.includes('no network') || lower.includes('outage') || lower.includes('emergency')) {
    return 'high';
  }
  if (lower.includes('slow') || lower.includes('billing')) {
    return 'medium';
  }
  return 'low';
}
