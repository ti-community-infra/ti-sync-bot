export class Time {
  private readonly date: Date | null;

  constructor(dateStr: string) {
    this.date = dateStr !== undefined ? new Date(dateStr) : null;
  }

  laterThan(time: Time) {
    return Number(this.date) > Number(time.date);
  }
}

/**
 * Convert a time string into a Time object that can support more operations.
 * @param dateStr
 */
export function time(dateStr: string) {
  return new Time(dateStr);
}
