// decodeCommaString is used to convert the comma string to array.
export function decodeLabelString(str: string): string[] {
  return str.split(",");
}

// encodeLabelArray is used to convert an array to a string that separates array items by commas.
export function encodeLabelArray(
  arr: {
    id?: number;
    name?: string;
  }[]
): string {
  return arr
    .map((label) => {
      return label.name;
    })
    .join(",");
}
