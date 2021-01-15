type label =
  | string
  | {
      id?: number;
      name?: string;
    };

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
 * @param labelArr
 * @return Label string, e.g. "type/feature,status/can-merge".
 */
export function encodeLabelArray(labelArr: label[]): string {
  return labelArr
    .map((label) => {
      if (typeof label === "string") {
        return label;
      } else {
        return label.name?.trim();
      }
    })
    .join(",");
}
