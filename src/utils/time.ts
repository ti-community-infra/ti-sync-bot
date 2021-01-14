export class Time {
  private readonly date: Date | null;

  constructor(dateStr: string) {
    this.date = dateStr !== undefined ? new Date(dateStr) : null;
  }

  laterThan(time: Time) {
    return Number(this.date) > Number(time.date);
  }
}

export function time(dateStr: string) {
  return new Time(dateStr);
}
