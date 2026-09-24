import "tailwindcss";

export default function PageHeader({ title }: { title: string }) {
  const currentDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  return (
    <div className="bg-primary-foreground flex justify-between">
      <h2>{title}</h2>
      <h2>{currentDate}</h2>
    </div>
  );
}
