import { dateTime, relativeTime } from '../../lib/format';

/** "2 days ago", with the exact time on hover / long-press and in the markup for assistive tech. */
export function RelativeTime({ value }: { value: string | number | Date }) {
  return (
    <time dateTime={new Date(value).toISOString()} title={dateTime(value)}>
      {relativeTime(value)}
    </time>
  );
}
