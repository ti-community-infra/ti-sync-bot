// decodeCommaString is used to convert the comma string to array.
export function decodeCommaString(str: string): string[] {
  return str.split(",");
}

// encodeCommaArray is used to convert an array to a string that separates array items by commas.
export function encodeCommaArray(arr: string[]): string {
  return arr.join(",");
}
