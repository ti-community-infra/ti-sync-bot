/**
 * Convert the comma string to array.
 * @param str Label string separated by commas, e.g. "type/feature,status/can-merge".
 * @return Label array, e.g. ["type/feature", "status/can-merge"].
 */
export function decodeLabelString(str: string): string[] {
  return str.split(",");
}

/**
 * Convert an array to a string that separates array items by commas.
 * @param arr A label string array, e.g. ["type/feature", "status/can-merge"].
 * @return Label string, e.g. "type/feature,status/can-merge".
 */
export function encodeLabelArray(
  arr: {
    id?: number;
    name?: string;
  }[]
): string {
  return arr
    .map((label) => {
      return label.name?.trim();
    })
    .join(",");
}
