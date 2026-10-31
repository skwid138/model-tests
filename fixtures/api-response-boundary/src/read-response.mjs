export function readCampaignRows(response) {
  if (
    response === null ||
    typeof response !== 'object' ||
    Array.isArray(response) ||
    response.ok !== true
  ) {
    return [];
  }

  const { body } = response;
  if (
    body === null ||
    typeof body !== 'object' ||
    !Array.isArray(body.items)
  ) {
    return [];
  }

  return body.items;
}
