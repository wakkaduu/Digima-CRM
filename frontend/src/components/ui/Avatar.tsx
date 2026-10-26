/** A stable pale tint per person: identity, not data. Neighbouring indexes are far apart on the hue wheel. */
const hueFor = (index: number) => (index * 67 + 20) % 360;

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** Initials in a circle, in a pale tint of the person's own hue with the dark of the same hue as the letters. */
export function Avatar({ name, index }: { name: string; index: number }) {
  const h = hueFor(index);
  return (
    <span
      aria-hidden
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-small font-semibold"
      style={{ backgroundColor: `hsl(${h} 45% 92%)`, color: `hsl(${h} 50% 24%)` }}
    >
      {initials(name)}
    </span>
  );
}
